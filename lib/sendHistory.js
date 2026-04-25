'use strict';

const crypto = require('crypto');
const db = require.main.require('./src/database');
const winston = require.main.require('winston');

const JOBS_KEY = 'announcement-mailer:jobs';
const JOB_PREFIX = 'announcement-mailer:job:';
const SENT_PREFIX = 'announcement-mailer:sent:';
const TEMPLATE_PREFIX = 'announcement-mailer:template:';
const MAX_JOBS = 100;
const LOG_PREFIX = '[ANNOUNCEMENT-MAILER:HISTORY]';

function generateJobId() {
	return `am_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

async function createJob({ subject, groupNames, totalRecipients, senderUid, templateHtml }) {
	const jobId = generateJobId();
	const jobData = {
		jobId,
		subject,
		htmlPreview: (templateHtml || '').substring(0, 300),
		groupNames: JSON.stringify(groupNames),
		totalRecipients,
		senderUid,
		status: 'queued',
		createdAt: Date.now(),
		startedAt: 0,
		completedAt: 0,
		successCount: 0,
		failCount: 0,
		progress: 0,
		openCount: 0,
		failures: '[]',
	};

	await db.setObject(`${JOB_PREFIX}${jobId}`, jobData);
	await db.setObjectField(`${JOB_PREFIX}${jobId}`, 'templateHtml', templateHtml);

	await db.sortedSetAdd(JOBS_KEY, Date.now(), jobId);

	// Cleanup old jobs — skip active ones
	const count = await db.sortedSetCard(JOBS_KEY);
	if (count > MAX_JOBS) {
		const toRemove = await db.getSortedSetRange(JOBS_KEY, 0, count - MAX_JOBS - 1);
		for (const oldJobId of toRemove) {
			const status = await db.getObjectField(`${JOB_PREFIX}${oldJobId}`, 'status');
			if (status === 'sending' || status === 'scheduled') continue;
			await db.sortedSetRemove(JOBS_KEY, oldJobId);
			await db.delete(`${JOB_PREFIX}${oldJobId}`);
			await db.delete(`${SENT_PREFIX}${oldJobId}`);
			await db.delete(`announcement-mailer:queue:${oldJobId}`);
			await db.delete(`announcement-mailer:opens:${oldJobId}`);
		}
	}

	winston.info(`${LOG_PREFIX} Job ${jobId} created: "${subject}" -> ${totalRecipients} recipients`);
	return jobId;
}

async function updateJob(jobId, updates) {
	const data = { ...updates };
	if (data.failures && Array.isArray(data.failures)) {
		data.failures = JSON.stringify(data.failures);
	}
	if (data.groupNames && Array.isArray(data.groupNames)) {
		data.groupNames = JSON.stringify(data.groupNames);
	}
	await db.setObject(`${JOB_PREFIX}${jobId}`, data);
}

async function getJob(jobId) {
	const raw = await db.getObject(`${JOB_PREFIX}${jobId}`);
	if (!raw) return null;
	return parseJobData(raw);
}

async function getAll() {
	const jobIds = await db.getSortedSetRevRange(JOBS_KEY, 0, MAX_JOBS - 1);
	if (!jobIds || jobIds.length === 0) return [];

	const keys = jobIds.map(id => `${JOB_PREFIX}${id}`);
	const rawJobs = await db.getObjects(keys);

	const jobs = [];
	for (const raw of rawJobs) {
		if (raw) {
			delete raw.templateHtml;
			jobs.push(parseJobData(raw));
		}
	}
	return jobs;
}

async function isAlreadySent(jobId, email) {
	return await db.isSetMember(`${SENT_PREFIX}${jobId}`, email);
}

async function markSent(jobId, email) {
	await db.setAdd(`${SENT_PREFIX}${jobId}`, email);
}

async function markFailed(jobId, email, error, uid, username) {
	const job = await db.getObject(`${JOB_PREFIX}${jobId}`);
	if (!job) return;

	let failures = [];
	try {
		failures = JSON.parse(job.failures || '[]');
	} catch (e) {
		failures = [];
	}

	const existing = failures.findIndex(f => f.email === email);
	if (existing >= 0) {
		failures[existing].error = error;
		failures[existing].lastAttempt = Date.now();
		if (uid) failures[existing].uid = uid;
		if (username) failures[existing].username = username;
	} else {
		failures.push({ email, uid: uid || 0, username: username || '', error, lastAttempt: Date.now() });
	}

	if (failures.length > 200) {
		winston.warn(`${LOG_PREFIX} Job ${jobId}: Truncating failures from ${failures.length} to 200`);
		failures = failures.slice(-200);
	}

	await db.setObjectField(`${JOB_PREFIX}${jobId}`, 'failures', JSON.stringify(failures));
}

async function getJobsByStatus(status) {
	const jobIds = await db.getSortedSetRevRange(JOBS_KEY, 0, -1);
	if (!jobIds || jobIds.length === 0) return [];

	const keys = jobIds.map(id => `${JOB_PREFIX}${id}`);
	const rawJobs = await db.getObjects(keys);

	const matching = [];
	for (let i = 0; i < rawJobs.length; i++) {
		if (rawJobs[i] && rawJobs[i].status === status) {
			matching.push(jobIds[i]);
		}
	}
	return matching;
}

// ========================
// TEMPLATE LIBRARY
// ========================

async function saveTemplate(name, subject, html) {
	const key = `${TEMPLATE_PREFIX}${name}`;
	await db.setObject(key, { name, subject, html, updatedAt: Date.now() });
	await db.setAdd('announcement-mailer:templates', name);
}

async function getTemplate(name) {
	return await db.getObject(`${TEMPLATE_PREFIX}${name}`);
}

async function getAllTemplates() {
	const names = await db.getSetMembers('announcement-mailer:templates');
	if (!names || names.length === 0) return [];
	const templates = [];
	for (const name of names.sort()) {
		const tpl = await db.getObject(`${TEMPLATE_PREFIX}${name}`);
		if (tpl) templates.push(tpl);
	}
	return templates;
}

async function deleteTemplate(name) {
	await db.delete(`${TEMPLATE_PREFIX}${name}`);
	await db.setRemove('announcement-mailer:templates', name);
}

// Seed preset templates on first start. Each preset has its own one-time
// flag so a deleted preset does not get re-created on the next restart,
// and an existing user-saved template with the same name is never overwritten.
async function seedDefaultTemplates(presets) {
	const SEED_FLAG_PREFIX = 'announcement-mailer:default-seeded:';
	let seeded = 0;
	for (const preset of presets) {
		const flagKey = `${SEED_FLAG_PREFIX}${preset.name}`;
		try {
			const alreadySeeded = await db.exists(flagKey);
			if (alreadySeeded) continue;

			const existing = await db.getObject(`${TEMPLATE_PREFIX}${preset.name}`);
			if (!existing) {
				await saveTemplate(preset.name, preset.subject || '', preset.html);
				seeded++;
			}
			await db.set(flagKey, '1');
		} catch (err) {
			winston.warn(`${LOG_PREFIX} Failed to seed default template "${preset.name}": ${err.message}`);
		}
	}
	if (seeded > 0) {
		winston.info(`${LOG_PREFIX} Seeded ${seeded} default template(s).`);
	}
}

function parseJobData(raw) {
	return {
		...raw,
		totalRecipients: parseInt(raw.totalRecipients || 0, 10),
		senderUid: parseInt(raw.senderUid || 0, 10),
		createdAt: parseInt(raw.createdAt || 0, 10),
		startedAt: parseInt(raw.startedAt || 0, 10),
		completedAt: parseInt(raw.completedAt || 0, 10),
		successCount: parseInt(raw.successCount || 0, 10),
		failCount: parseInt(raw.failCount || 0, 10),
		progress: parseInt(raw.progress || 0, 10),
		openCount: parseInt(raw.openCount || 0, 10),
		scheduledAt: parseInt(raw.scheduledAt || 0, 10),
		groupNames: safeParse(raw.groupNames, []),
		failures: safeParse(raw.failures, []),
	};
}

function safeParse(str, fallback) {
	try {
		return JSON.parse(str);
	} catch (e) {
		winston.warn(`${LOG_PREFIX} Failed to parse JSON: ${String(str).substring(0, 50)}`);
		return fallback;
	}
}

module.exports = {
	createJob,
	updateJob,
	getJob,
	getAll,
	isAlreadySent,
	markSent,
	markFailed,
	getJobsByStatus,
	saveTemplate,
	getTemplate,
	getAllTemplates,
	deleteTemplate,
	seedDefaultTemplates,
};
