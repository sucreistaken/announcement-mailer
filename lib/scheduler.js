'use strict';

const winston = require.main.require('winston');
const sendHistory = require('./sendHistory');

const LOG_PREFIX = '[ANNOUNCEMENT-MAILER:SCHEDULER]';
const scheduledTimers = new Map();

// setTimeout accepts int32 ms max (~24.8 days). Longer delays chain re-schedule.
const MAX_TIMEOUT = 2147483647;

function scheduleJob(jobId, sendAt, executeFn) {
	const delay = sendAt - Date.now();
	if (delay <= 0) {
		winston.info(`${LOG_PREFIX} Job ${jobId}: Scheduled time already passed, executing immediately.`);
		executeFn().catch(err => {
			winston.error(`${LOG_PREFIX} Job ${jobId}: Scheduled execution failed: ${err.message}`);
		});
		return;
	}

	winston.info(`${LOG_PREFIX} Job ${jobId}: Scheduled for ${new Date(sendAt).toISOString()} (${Math.round(delay / 60000)} min from now)`);

	if (delay > MAX_TIMEOUT) {
		const timer = setTimeout(() => {
			scheduledTimers.delete(jobId);
			scheduleJob(jobId, sendAt, executeFn);
		}, MAX_TIMEOUT);
		scheduledTimers.set(jobId, timer);
		return;
	}

	const timer = setTimeout(async () => {
		scheduledTimers.delete(jobId);
		try {
			await executeFn();
		} catch (err) {
			winston.error(`${LOG_PREFIX} Job ${jobId}: Scheduled execution failed: ${err.message}`);
		}
	}, delay);

	scheduledTimers.set(jobId, timer);
}

function cancelScheduled(jobId) {
	const timer = scheduledTimers.get(jobId);
	if (timer) {
		clearTimeout(timer);
		scheduledTimers.delete(jobId);
		winston.info(`${LOG_PREFIX} Job ${jobId}: Scheduled send cancelled.`);
		return true;
	}
	return false;
}

function isScheduled(jobId) {
	return scheduledTimers.has(jobId);
}

async function recoverScheduledJobs(executeFnFactory) {
	try {
		const jobs = await sendHistory.getJobsByStatus('scheduled');
		for (const jobId of jobs) {
			const job = await sendHistory.getJob(jobId);
			if (!job || !job.scheduledAt) continue;

			const sendAt = parseInt(job.scheduledAt, 10);
			if (sendAt <= Date.now()) {
				winston.info(`${LOG_PREFIX} Job ${jobId}: Missed schedule, executing now.`);
				const fn = executeFnFactory(jobId);
				fn().catch(err => {
					winston.error(`${LOG_PREFIX} Job ${jobId}: Recovery execution failed: ${err.message}`);
				});
			} else {
				scheduleJob(jobId, sendAt, executeFnFactory(jobId));
			}
		}
	} catch (err) {
		winston.error(`${LOG_PREFIX} Recovery failed: ${err.message}`);
	}
}

module.exports = { scheduleJob, cancelScheduled, isScheduled, recoverScheduledJobs };
