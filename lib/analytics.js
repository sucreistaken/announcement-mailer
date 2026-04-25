'use strict';

const db = require.main.require('./src/database');
const winston = require.main.require('winston');

const OPEN_PREFIX = 'announcement-mailer:opens:';
const LOG_PREFIX = '[ANNOUNCEMENT-MAILER:ANALYTICS]';

// 1x1 transparent GIF pixel (43 bytes)
const TRACKING_PIXEL = Buffer.from(
	'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
	'base64'
);

async function recordOpen(jobId, uid) {
	// Validate the job actually exists — prevents DB pollution via the public pixel endpoint
	const exists = await db.isSortedSetMember('announcement-mailer:jobs', jobId);
	if (!exists) return;

	const key = `${OPEN_PREFIX}${jobId}`;
	const wasNew = !(await db.isSetMember(key, String(uid)));
	await db.setAdd(key, String(uid));
	if (wasNew) {
		await db.incrObjectField(`announcement-mailer:job:${jobId}`, 'openCount');
	}
}

async function getOpenCount(jobId) {
	const count = await db.getObjectField(`announcement-mailer:job:${jobId}`, 'openCount');
	return parseInt(count || 0, 10);
}

async function getOpenUids(jobId) {
	const key = `${OPEN_PREFIX}${jobId}`;
	return await db.getSetMembers(key);
}

function getTrackingPixelUrl(baseUrl, jobId, uid) {
	return `${baseUrl}/plugins/announcement-mailer/pixel/${jobId}/${uid}.gif`;
}

module.exports = {
	TRACKING_PIXEL,
	recordOpen,
	getOpenCount,
	getOpenUids,
	getTrackingPixelUrl,
};
