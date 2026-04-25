'use strict';

const nodemailer = require('nodemailer');
const db = require.main.require('./src/database');
const winston = require.main.require('winston');
const sendHistory = require('./sendHistory');
const emailRenderer = require('./emailRenderer');
const unsubscribe = require('./unsubscribe');
const analytics = require('./analytics');
const nconf = require.main.require('nconf');

const LOG_PREFIX = '[ANNOUNCEMENT-MAILER:QUEUE]';
const QUEUE_PREFIX = 'announcement-mailer:queue:';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BATCH_DELAY = 2000;
const DEFAULT_EMAIL_DELAY = 200;
const DEFAULT_MAX_RETRIES = 3;

const activeJobs = new Map();

function createTransporter(settings) {
	const port = parseInt(settings.smtpPort || '587', 10);
	return nodemailer.createTransport({
		host: settings.smtpHost,
		port,
		secure: port === 465,
		auth: {
			user: settings.smtpUser,
			pass: settings.smtpPass,
		},
		pool: true,
		maxConnections: 3,
		maxMessages: 50,
		connectionTimeout: 10000,
		greetingTimeout: 10000,
		socketTimeout: 30000,
	});
}

async function verifyTransporter(transporter) {
	try {
		await transporter.verify();
		winston.info(`${LOG_PREFIX} SMTP connection verified.`);
		return true;
	} catch (err) {
		winston.error(`${LOG_PREFIX} SMTP verification failed: ${err.message}`);
		return false;
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function enqueueRecipients(jobId, recipients) {
	const queueKey = `${QUEUE_PREFIX}${jobId}`;
	const CHUNK = 500;
	for (let i = 0; i < recipients.length; i += CHUNK) {
		const chunk = recipients.slice(i, i + CHUNK);
		const scores = chunk.map((_, idx) => i + idx);
		const values = chunk.map(r => JSON.stringify({
			email: r.email,
			uid: r.uid,
			username: r.username,
			attempt: 0,
		}));
		await db.sortedSetAdd(queueKey, scores, values);
	}
}

async function dequeueBatch(jobId, count) {
	const queueKey = `${QUEUE_PREFIX}${jobId}`;
	const items = await db.getSortedSetRange(queueKey, 0, count - 1);
	if (!items || items.length === 0) return [];

	const parsed = [];
	for (const item of items) {
		await db.sortedSetRemove(queueKey, item);
		try {
			parsed.push(JSON.parse(item));
		} catch (e) {
			winston.warn(`${LOG_PREFIX} Failed to parse queue item: ${item}`);
		}
	}
	return parsed;
}

async function requeueItem(jobId, item) {
	const queueKey = `${QUEUE_PREFIX}${jobId}`;
	const score = Date.now();
	await db.sortedSetAdd(queueKey, score, JSON.stringify(item));
}

async function getQueueSize(jobId) {
	const queueKey = `${QUEUE_PREFIX}${jobId}`;
	return await db.sortedSetCard(queueKey);
}

// SMTP error code classification for bounce handling
function isHardBounce(err) {
	const code = err.responseCode || 0;
	// 5xx permanent failures (except 552 which can be temporary)
	return (code >= 550 && code <= 559 && code !== 552);
}

async function startSending({ jobId, recipients, subject, templateHtml, settings }) {
	const batchSize = Math.min(500, Math.max(1, parseInt(settings.batchSize || DEFAULT_BATCH_SIZE, 10)));
	const batchDelay = Math.max(0, parseInt(settings.batchDelay || DEFAULT_BATCH_DELAY, 10));
	const emailDelay = Math.max(0, parseInt(settings.emailDelay || DEFAULT_EMAIL_DELAY, 10));
	const maxRetries = Math.max(1, parseInt(settings.maxRetries || DEFAULT_MAX_RETRIES, 10));
	const fromAddress = settings.smtpFrom || settings.smtpUser;
	const baseUrl = nconf.get('url') || '';

	const jobState = { cancelled: false };
	activeJobs.set(jobId, jobState);

	winston.info(`${LOG_PREFIX} Job ${jobId}: Enqueueing ${recipients.length} recipients`);
	await enqueueRecipients(jobId, recipients);

	// Load previous success count for retry accumulation
	const existingJob = await sendHistory.getJob(jobId);
	const previousSuccess = parseInt(existingJob?.retryPreviousSuccess || 0, 10);

	await sendHistory.updateJob(jobId, {
		status: 'sending',
		startedAt: Date.now(),
	});

	const transporter = createTransporter(settings);

	// Verify SMTP before starting
	const verified = await verifyTransporter(transporter);
	if (!verified) {
		activeJobs.delete(jobId);
		await sendHistory.updateJob(jobId, {
			status: 'interrupted',
			completedAt: Date.now(),
		});
		winston.error(`${LOG_PREFIX} Job ${jobId}: SMTP verification failed, aborting.`);
		return;
	}

	const defaultVars = emailRenderer.getDefaultVariables();

	let successCount = previousSuccess;
	let failCount = 0;
	let processed = 0;

	winston.info(`${LOG_PREFIX} Job ${jobId}: Starting (batch=${batchSize}, batchDelay=${batchDelay}ms, emailDelay=${emailDelay}ms, maxRetries=${maxRetries})`);

	try {
		while (true) {
			if (jobState.cancelled) {
				winston.info(`${LOG_PREFIX} Job ${jobId}: Cancelled by admin`);
				break;
			}

			const batch = await dequeueBatch(jobId, batchSize);
			if (batch.length === 0) break;

			for (let i = 0; i < batch.length; i++) {
				if (jobState.cancelled) break;

				const item = batch[i];

				// Skip already sent (duplicate prevention)
				const alreadySent = await sendHistory.isAlreadySent(jobId, item.email);
				if (alreadySent) {
					processed++;
					continue;
				}

				// Skip unsubscribed users
				if (item.uid && await unsubscribe.isUnsubscribed(item.uid)) {
					processed++;
					continue;
				}

				// Skip hard-bounced emails
				if (await unsubscribe.isBounced(item.email)) {
					processed++;
					continue;
				}

				const variables = {
					...defaultVars,
					username: item.username || '',
					email: item.email || '',
				};

				// Add unsubscribe URL if user has uid
				if (item.uid) {
					variables.unsubscribeUrl = await unsubscribe.getUnsubscribeUrl(item.uid);
				}

				const html = emailRenderer.renderHtml(templateHtml, variables);
				const text = emailRenderer.renderPlainText(html);

				// Add tracking pixel
				const trackingHtml = html + `<img src="${analytics.getTrackingPixelUrl(baseUrl, jobId, item.uid || 0)}" width="1" height="1" alt="" style="display:none;" />`;

				try {
					// Build email headers
					const mailOptions = {
						from: fromAddress,
						to: item.email,
						subject,
						html: trackingHtml,
						text,
					};

					// Add List-Unsubscribe headers
					if (item.uid) {
						const unsubHeaders = await unsubscribe.getUnsubscribeHeaders(item.uid);
						mailOptions.headers = unsubHeaders;
					}

					await transporter.sendMail(mailOptions);

					await sendHistory.markSent(jobId, item.email);
					successCount++;
				} catch (err) {
					// Handle hard bounces
					if (isHardBounce(err)) {
						await unsubscribe.addBounce(item.email);
						failCount++;
						await sendHistory.markFailed(jobId, item.email, `Hard bounce: ${err.message}`, item.uid, item.username);
						winston.warn(`${LOG_PREFIX} Job ${jobId}: Hard bounce for ${item.email}: ${err.message}`);
					} else {
						const attempt = (item.attempt || 0) + 1;
						if (attempt < maxRetries) {
							await requeueItem(jobId, { ...item, attempt });
							winston.warn(`${LOG_PREFIX} Job ${jobId}: Send to ${item.email} failed (attempt ${attempt}/${maxRetries}), re-queued: ${err.message}`);
						} else {
							failCount++;
							await sendHistory.markFailed(jobId, item.email, err.message, item.uid, item.username);
							winston.warn(`${LOG_PREFIX} Job ${jobId}: Send to ${item.email} permanently failed after ${maxRetries} attempts: ${err.message}`);
						}
					}
				}

				processed++;

				if (emailDelay > 0 && i < batch.length - 1) {
					await sleep(emailDelay);
				}
			}

			await sendHistory.updateJob(jobId, {
				progress: processed,
				successCount,
				failCount,
			});

			const remaining = await getQueueSize(jobId);
			if (remaining === 0) break;

			if (batchDelay > 0) {
				await sleep(batchDelay);
			}
		}
	} catch (err) {
		winston.error(`${LOG_PREFIX} Job ${jobId}: Unexpected error: ${err.message}`);
	} finally {
		transporter.close();
		activeJobs.delete(jobId);
	}

	const finalStatus = jobState.cancelled ? 'cancelled' : 'completed';

	await sendHistory.updateJob(jobId, {
		status: finalStatus,
		completedAt: Date.now(),
		successCount,
		failCount,
		progress: processed,
	});

	winston.info(`${LOG_PREFIX} Job ${jobId}: ${finalStatus}. Success: ${successCount}, Failed: ${failCount}, Processed: ${processed}`);
}

function cancelJob(jobId) {
	const jobState = activeJobs.get(jobId);
	if (jobState) {
		jobState.cancelled = true;
		return true;
	}
	return false;
}

function isJobActive(jobId) {
	return activeJobs.has(jobId);
}

module.exports = {
	createTransporter,
	verifyTransporter,
	startSending,
	cancelJob,
	isJobActive,
	getQueueSize,
	activeJobs,
};
