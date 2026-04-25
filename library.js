'use strict';

const db = require.main.require('./src/database');
const user = require.main.require('./src/user');
const groups = require.main.require('./src/groups');
const meta = require.main.require('./src/meta');
const topics = require.main.require('./src/topics');
const posts = require.main.require('./src/posts');
const notifications = require.main.require('./src/notifications');
const nconf = require.main.require('nconf');
const winston = require.main.require('winston');

const emailQueue = require('./lib/emailQueue');
const emailRenderer = require('./lib/emailRenderer');
const sendHistory = require('./lib/sendHistory');
const jobLock = require('./lib/jobLock');
const unsubscribe = require('./lib/unsubscribe');
const scheduler = require('./lib/scheduler');
const analytics = require('./lib/analytics');

const Plugin = {};
const PLUGIN_ID = 'announcement-mailer';
const LOG_PREFIX = '[ANNOUNCEMENT-MAILER]';

const HIDDEN_GROUPS = [
	'administrators',
	'Global Moderators',
	'unverified-users',
	'banned-users',
	'registered-users',
];

// ========================
// SETTINGS HELPER (P7 fix: explicit error handling)
// ========================

async function getSettings() {
	try {
		return (await meta.settings.get(PLUGIN_ID)) || {};
	} catch (err) {
		winston.error(`${LOG_PREFIX} Failed to load settings: ${err.message}`);
		throw err;
	}
}

async function getSettingsSafe() {
	try {
		return await getSettings();
	} catch (err) {
		return {};
	}
}

// ========================
// ADMIN CHECK MIDDLEWARE
// ========================

function adminRequired(req, res, next) {
	user.isAdministrator(req.uid).then((isAdmin) => {
		if (!isAdmin) {
			return res.status(403).json({ error: 'Forbidden' });
		}
		next();
	}).catch(() => res.status(403).json({ error: 'Forbidden' }));
}

// ========================
// HELPERS
// ========================

async function collectRecipients(groupNames) {
	const uidSet = new Set();
	for (const groupName of groupNames) {
		const members = await groups.getMembers(groupName, 0, -1);
		members.forEach(uid => uidSet.add(parseInt(uid, 10)));
	}
	uidSet.delete(0);

	const uids = Array.from(uidSet);
	const recipients = [];
	const CHUNK_SIZE = 500;

	for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
		const chunk = uids.slice(i, i + CHUNK_SIZE);
		const usersData = await user.getUsersFields(chunk, ['uid', 'email', 'username']);
		for (const u of usersData) {
			if (u && u.email) {
				recipients.push({ uid: u.uid, email: u.email, username: u.username || '' });
			}
		}
	}
	return recipients;
}

async function executeJob(jobId) {
	const job = await sendHistory.getJob(jobId);
	if (!job) return;

	const settings = await getSettings();
	const fullJob = await db.getObject(`announcement-mailer:job:${jobId}`);
	const templateHtml = fullJob.templateHtml;
	const groupNames = JSON.parse(fullJob.groupNames || '[]');

	const recipients = await collectRecipients(groupNames);
	if (recipients.length === 0) return;

	await sendHistory.updateJob(jobId, { totalRecipients: recipients.length });

	await emailQueue.startSending({
		jobId,
		recipients,
		subject: job.subject,
		templateHtml,
		settings,
	});
}

// ========================
// PLUGIN INIT
// ========================

Plugin.init = async function (params) {
	const { router, middleware } = params;

	winston.info(`${LOG_PREFIX} Initializing plugin...`);

	// Recover orphan jobs
	try {
		const orphanJobs = await sendHistory.getJobsByStatus('sending');
		for (const jobId of orphanJobs) {
			if (!emailQueue.isJobActive(jobId)) {
				await sendHistory.updateJob(jobId, { status: 'interrupted', completedAt: Date.now() });
				winston.warn(`${LOG_PREFIX} Orphan job ${jobId} marked as interrupted`);
			}
		}
	} catch (err) {
		winston.error(`${LOG_PREFIX} Orphan recovery failed: ${err.message}`);
	}

	// Recover scheduled jobs
	scheduler.recoverScheduledJobs((jobId) => () => executeJob(jobId));

	// ========================
	// ADMIN PAGE ROUTES
	// ========================

	function renderAdmin(req, res) {
		res.render('admin/plugins/announcement-mailer', { title: 'Announcement Mailer' });
	}

	router.get('/admin/plugins/announcement-mailer', middleware.admin.buildHeader, renderAdmin);
	router.get('/api/admin/plugins/announcement-mailer', renderAdmin);

	// ========================
	// PUBLIC ROUTES (unsubscribe + tracking pixel)
	// ========================

	// Unsubscribe endpoint
	router.get('/email/unsubscribe', async (req, res) => {
		try {
			const { uid, token } = req.query;
			if (!uid || !token) {
				return res.status(400).send('<h2>Gecersiz link.</h2>');
			}

			const valid = await unsubscribe.verifyToken(uid, token);
			if (!valid) {
				return res.status(400).send('<h2>Gecersiz veya suresi dolmus link.</h2>');
			}

			await unsubscribe.unsubscribe(uid);

			const siteName = emailRenderer.escapeHtml(meta.config.title || 'Forum');
			res.send(`
				<html><body style="font-family:sans-serif;text-align:center;padding:60px;">
				<h2>Email aboneligi iptal edildi</h2>
				<p>${siteName} duyuru emaillerinden basariyla cikarildiniz.</p>
				</body></html>
			`);
		} catch (err) {
			winston.error(`${LOG_PREFIX} Unsubscribe handler error: ${err.message}`);
			res.status(500).send('<h2>Bir hata olustu. Lutfen daha sonra tekrar deneyin.</h2>');
		}
	});

	// Tracking pixel endpoint
	const JOB_ID_RE = /^am_\d+_[a-f0-9]{16}$/;
	const UID_RE = /^\d+$/;
	router.get('/plugins/announcement-mailer/pixel/:jobId/:uid.gif', async (req, res) => {
		const { jobId, uid } = req.params;
		res.set({
			'Content-Type': 'image/gif',
			'Cache-Control': 'no-store, no-cache, must-revalidate',
			'Pragma': 'no-cache',
		});
		res.send(analytics.TRACKING_PIXEL);

		// Record open asynchronously — validate formats; recordOpen also checks job existence
		if (JOB_ID_RE.test(jobId) && UID_RE.test(uid) && uid !== '0') {
			analytics.recordOpen(jobId, uid).catch(() => {});
		}
	});

	// ========================
	// API ROUTES
	// ========================

	const apiBase = '/api/admin/plugins/announcement-mailer';

	// GET /groups
	router.get(`${apiBase}/groups`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		try {
			const allGroups = await db.getSortedSetRevRange('groups:createtime', 0, -1);
			const filtered = allGroups.filter(g =>
				!g.startsWith('cid:') && !g.startsWith('ip-') &&
				!HIDDEN_GROUPS.includes(g) && g !== '' &&
				g.indexOf(':privileges:') === -1
			);
			return res.json({ groups: filtered });
		} catch (err) {
			winston.error(`${LOG_PREFIX} Error fetching groups: ${err.message}`);
			return res.status(500).json({ error: 'Failed to fetch groups' });
		}
	});

	// POST /send
	router.post(`${apiBase}/send`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		const { subject, templateHtml, groupNames, scheduledAt } = req.body;

		if (!subject || !templateHtml || !Array.isArray(groupNames) || groupNames.length === 0) {
			return res.status(400).json({ error: 'subject, templateHtml ve groupNames zorunludur.' });
		}

		try {
			const settings = await getSettings();
			if (!settings.smtpHost || !settings.smtpUser) {
				return res.status(400).json({ error: 'SMTP ayarlari yapilandirilmamis.' });
			}

			const recipients = await collectRecipients(groupNames);
			if (recipients.length === 0) {
				return res.status(400).json({ error: 'Gecerli email adresi olan kullanici bulunamadi.' });
			}

			const jobId = await sendHistory.createJob({
				subject, groupNames, totalRecipients: recipients.length,
				senderUid: req.uid, templateHtml,
			});

			// Scheduled send
			if (scheduledAt && parseInt(scheduledAt, 10) > Date.now()) {
				const sendAt = parseInt(scheduledAt, 10);
				await sendHistory.updateJob(jobId, { status: 'scheduled', scheduledAt: sendAt });

				scheduler.scheduleJob(jobId, sendAt, async () => {
					const freshSettings = await getSettings();
					const freshRecipients = await collectRecipients(groupNames);
					await sendHistory.updateJob(jobId, { totalRecipients: freshRecipients.length });
					await emailQueue.startSending({ jobId, recipients: freshRecipients, subject, templateHtml, settings: freshSettings });
				});

				return res.json({ success: true, jobId, recipientCount: recipients.length,
					message: `Gonderim zamanlanildi: ${new Date(sendAt).toLocaleString('tr-TR')}. ${recipients.length} alici.` });
			}

			// Immediate send
			emailQueue.startSending({ jobId, recipients, subject, templateHtml, settings })
				.catch(err => winston.error(`${LOG_PREFIX} Background send error for job ${jobId}: ${err.message}`));

			return res.json({ success: true, jobId, recipientCount: recipients.length,
				message: `Gonderim baslatildi. ${recipients.length} alici kuyruge eklendi.` });
		} catch (err) {
			winston.error(`${LOG_PREFIX} Send error: ${err.message}`);
			return res.status(500).json({ error: 'Gonderim baslatilirken hata olustu.' });
		}
	});

	// POST /test
	router.post(`${apiBase}/test`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		const { testEmail, subject, templateHtml } = req.body;
		if (!testEmail) return res.status(400).json({ error: 'testEmail zorunludur.' });

		try {
			const settings = await getSettings();
			if (!settings.smtpHost || !settings.smtpUser) {
				return res.status(400).json({ error: 'SMTP ayarlari yapilandirilmamis.' });
			}

			const transporter = emailQueue.createTransporter(settings);
			const verified = await emailQueue.verifyTransporter(transporter);
			if (!verified) {
				transporter.close();
				return res.status(500).json({ error: 'SMTP baglantisi dogrulanamadi.' });
			}

			const defaultVars = emailRenderer.getDefaultVariables();
			const html = emailRenderer.renderHtml(templateHtml || '<p>Bu bir test emailidir.</p>', { ...defaultVars, username: 'Test User', email: testEmail });
			const text = emailRenderer.renderPlainText(html);

			await transporter.sendMail({
				from: settings.smtpFrom || settings.smtpUser, to: testEmail,
				subject: subject || 'Test Email - Announcement Mailer', html, text,
			});
			transporter.close();
			return res.json({ success: true, message: `Test emaili ${testEmail} adresine gonderildi.` });
		} catch (err) {
			winston.error(`${LOG_PREFIX} Test email error: ${err.message}`);
			return res.status(500).json({ error: `Test basarisiz: ${err.message}` });
		}
	});

	// GET /history
	router.get(`${apiBase}/history`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		try {
			const history = await sendHistory.getAll();
			for (const job of history) {
				if (job.status === 'sending' && emailQueue.isJobActive(job.jobId)) {
					job.queueRemaining = await emailQueue.getQueueSize(job.jobId);
				}
				// Enrich with open rate
				if (job.successCount > 0) {
					job.openRate = job.openCount > 0 ? Math.round((job.openCount / job.successCount) * 100) : 0;
				}
			}
			return res.json({ history });
		} catch (err) {
			return res.status(500).json({ error: 'Gecmis yuklenemedi.' });
		}
	});

	// GET /history/:jobId
	router.get(`${apiBase}/history/:jobId`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		try {
			const job = await sendHistory.getJob(req.params.jobId);
			if (!job) return res.status(404).json({ error: 'Job bulunamadi.' });
			return res.json({ job });
		} catch (err) {
			return res.status(500).json({ error: 'Job detaylari yuklenemedi.' });
		}
	});

	// POST /cancel/:jobId (P3: mutex lock)
	router.post(`${apiBase}/cancel/:jobId`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		const { jobId } = req.params;

		if (!jobLock.acquire(jobId)) {
			return res.status(400).json({ error: 'Bu job uzerinde baska islem devam ediyor.' });
		}

		try {
			const job = await sendHistory.getJob(jobId);

			if (job && job.status === 'pending_approval') {
				await sendHistory.updateJob(jobId, { status: 'cancelled', completedAt: Date.now() });
				return res.json({ success: true, message: 'Duyuru email taslagi reddedildi.' });
			}

			if (job && job.status === 'scheduled') {
				scheduler.cancelScheduled(jobId);
				await sendHistory.updateJob(jobId, { status: 'cancelled', completedAt: Date.now() });
				return res.json({ success: true, message: 'Zamanlanmis gonderim iptal edildi.' });
			}

			const cancelled = emailQueue.cancelJob(jobId);
			if (cancelled) {
				return res.json({ success: true, message: 'Gonderim iptal ediliyor.' });
			}
			return res.status(400).json({ error: 'Aktif gonderim bulunamadi.' });
		} finally {
			jobLock.release(jobId);
		}
	});

	// POST /retry/:jobId (P3: mutex lock)
	router.post(`${apiBase}/retry/:jobId`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		const { jobId } = req.params;

		if (!jobLock.acquire(jobId)) {
			return res.status(400).json({ error: 'Bu job uzerinde baska islem devam ediyor.' });
		}

		try {
			const job = await sendHistory.getJob(jobId);
			if (!job) return res.status(404).json({ error: 'Job bulunamadi.' });
			if (emailQueue.isJobActive(jobId)) return res.status(400).json({ error: 'Bu job hala aktif.' });
			if (!job.failures || job.failures.length === 0) return res.status(400).json({ error: 'Basarisiz email yok.' });

			const settings = await getSettings();
			if (!settings.smtpHost || !settings.smtpUser) return res.status(400).json({ error: 'SMTP ayarlari yapilandirilmamis.' });

			const fullJob = await db.getObject(`announcement-mailer:job:${jobId}`);
			const templateHtml = fullJob.templateHtml || '<p>{username}</p>';

			const recipients = job.failures.map(f => ({ uid: f.uid || 0, email: f.email, username: f.username || '' }));

			await sendHistory.updateJob(jobId, {
				failCount: 0, failures: '[]', status: 'sending',
				completedAt: 0, retryPreviousSuccess: job.successCount,
			});

			emailQueue.startSending({ jobId, recipients, subject: job.subject, templateHtml, settings })
				.catch(err => winston.error(`${LOG_PREFIX} Retry error for job ${jobId}: ${err.message}`));

			return res.json({ success: true, message: `${recipients.length} basarisiz email yeniden gonderiliyor.` });
		} finally {
			jobLock.release(jobId);
		}
	});

	// POST /approve/:jobId (P3: mutex lock)
	router.post(`${apiBase}/approve/:jobId`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		const { jobId } = req.params;

		if (!jobLock.acquire(jobId)) {
			return res.status(400).json({ error: 'Bu job uzerinde baska islem devam ediyor.' });
		}

		try {
			const job = await sendHistory.getJob(jobId);
			if (!job) return res.status(404).json({ error: 'Job bulunamadi.' });
			if (job.status !== 'pending_approval') return res.status(400).json({ error: 'Bu job onay bekleyen durumda degil.' });

			const settings = await getSettings();
			if (!settings.smtpHost || !settings.smtpUser) return res.status(400).json({ error: 'SMTP ayarlari yapilandirilmamis.' });

			const fullJob = await db.getObject(`announcement-mailer:job:${jobId}`);
			const templateHtml = fullJob.templateHtml;
			const groupNames = JSON.parse(fullJob.groupNames || '[]');

			const recipients = await collectRecipients(groupNames);
			if (recipients.length === 0) return res.status(400).json({ error: 'Gecerli email adresi olan kullanici bulunamadi.' });

			await sendHistory.updateJob(jobId, { totalRecipients: recipients.length });

			emailQueue.startSending({ jobId, recipients, subject: job.subject, templateHtml, settings })
				.catch(err => winston.error(`${LOG_PREFIX} Approve send error for job ${jobId}: ${err.message}`));

			return res.json({ success: true, message: `Onaylandi. ${recipients.length} aliciya gonderim baslatildi.` });
		} finally {
			jobLock.release(jobId);
		}
	});

	// ========================
	// TEMPLATE LIBRARY ROUTES
	// ========================

	router.get(`${apiBase}/templates`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		try {
			const templates = await sendHistory.getAllTemplates();
			return res.json({ templates });
		} catch (err) {
			return res.status(500).json({ error: 'Template listesi yuklenemedi.' });
		}
	});

	router.post(`${apiBase}/templates`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		const { name, subject, html } = req.body;
		if (!name || !html) return res.status(400).json({ error: 'name ve html zorunludur.' });
		try {
			await sendHistory.saveTemplate(name, subject || '', html);
			return res.json({ success: true, message: `Template "${name}" kaydedildi.` });
		} catch (err) {
			return res.status(500).json({ error: 'Template kaydedilemedi.' });
		}
	});

	router.delete(`${apiBase}/templates/:name`, middleware.ensureLoggedIn, adminRequired, async (req, res) => {
		try {
			await sendHistory.deleteTemplate(req.params.name);
			return res.json({ success: true });
		} catch (err) {
			return res.status(500).json({ error: 'Template silinemedi.' });
		}
	});

	winston.info(`${LOG_PREFIX} Plugin initialized successfully.`);
};

// ========================
// AUTO-ANNOUNCEMENT HOOK (P1: XSS fix)
// ========================

Plugin.onTopicPost = async function (hookData) {
	try {
		const settings = await getSettingsSafe();
		const announcementCid = parseInt(settings.announcementCategoryId, 10);
		if (!announcementCid) return;

		const { topic, post } = hookData;
		if (!topic || !post) return;
		if (parseInt(topic.cid, 10) !== announcementCid) return;

		const autoGroups = settings.autoEmailGroups;
		let groupNames = [];
		if (typeof autoGroups === 'string') {
			try { groupNames = JSON.parse(autoGroups); } catch (e) { groupNames = []; }
		} else if (Array.isArray(autoGroups)) {
			groupNames = autoGroups;
		}

		if (groupNames.length === 0) return;

		const authorData = await user.getUserFields(topic.uid, ['username']);
		const authorName = authorData.username || '';

		const subjectTemplate = settings.autoEmailSubject || 'Yeni Duyuru: {topicTitle}';
		const subject = subjectTemplate.replace(/\{topicTitle\}/g, emailRenderer.escapeHtml(topic.title || ''));

		const bodyTemplate = settings.autoEmailTemplate ||
			'<h2>{topicTitle}</h2><p>Merhaba {username},</p><p>{topicContent}</p><p><a href="{topicUrl}">Duyuruyu Oku</a></p>';

		const siteUrl = nconf.get('url') || '';
		const topicUrl = `${siteUrl}/topic/${topic.tid}`;

		// P1 FIX: Escape user-supplied content before injecting into template
		const templateWithTopicVars = bodyTemplate
			.replace(/\{topicTitle\}/g, emailRenderer.escapeHtml(topic.title || ''))
			.replace(/\{topicUrl\}/g, topicUrl)
			.replace(/\{topicContent\}/g, emailRenderer.escapeHtml(post.content || ''))
			.replace(/\{authorName\}/g, emailRenderer.escapeHtml(authorName));

		const jobId = await sendHistory.createJob({
			subject, groupNames, totalRecipients: 0,
			senderUid: topic.uid, templateHtml: templateWithTopicVars,
		});

		await sendHistory.updateJob(jobId, {
			status: 'pending_approval', topicTid: topic.tid, topicTitle: topic.title,
		});

		// Send notification to admins
		try {
			const adminUids = await groups.getMembers('administrators', 0, -1);
			if (adminUids.length > 0) {
				const notification = await notifications.create({
					type: 'announcement-mailer-pending',
					bodyShort: `Yeni duyuru email onay bekliyor: "${topic.title}"`,
					path: '/admin/plugins/announcement-mailer',
					nid: `announcement-mailer:pending:${jobId}`,
					from: topic.uid,
				});
				if (notification) {
					await notifications.push(notification, adminUids);
				}
			}
		} catch (err) {
			winston.warn(`${LOG_PREFIX} Failed to send admin notification: ${err.message}`);
		}

		winston.info(`${LOG_PREFIX} Auto-announcement created: job ${jobId} for topic "${topic.title}", awaiting approval.`);
	} catch (err) {
		winston.error(`${LOG_PREFIX} onTopicPost error: ${err.message}`);
	}
};

// ========================
// ADMIN NAVIGATION
// ========================

Plugin.addAdminNavigation = async function (header) {
	header.plugins.push({
		route: '/plugins/announcement-mailer',
		icon: 'fa-envelope',
		name: 'Announcement Mailer',
	});
	return header;
};

module.exports = Plugin;
