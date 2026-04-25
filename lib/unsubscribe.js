'use strict';

const crypto = require('crypto');
const db = require.main.require('./src/database');
const nconf = require.main.require('nconf');
const winston = require.main.require('winston');

const UNSUB_KEY = 'announcement-mailer:unsubscribed';
const BOUNCE_KEY = 'announcement-mailer:bounced';
const TOKEN_SECRET_KEY = 'announcement-mailer:token-secret';
const LOG_PREFIX = '[ANNOUNCEMENT-MAILER:UNSUB]';

async function getTokenSecret() {
	let secret = await db.get(TOKEN_SECRET_KEY);
	if (!secret) {
		secret = crypto.randomBytes(32).toString('hex');
		await db.set(TOKEN_SECRET_KEY, secret);
	}
	return secret;
}

function generateToken(uid, secret) {
	return crypto
		.createHmac('sha256', secret)
		.update(String(uid))
		.digest('hex')
		.substring(0, 16);
}

async function getUnsubscribeUrl(uid) {
	const secret = await getTokenSecret();
	const token = generateToken(uid, secret);
	const baseUrl = nconf.get('url') || '';
	return `${baseUrl}/email/unsubscribe?uid=${uid}&token=${token}`;
}

async function verifyToken(uid, token) {
	const secret = await getTokenSecret();
	const expected = generateToken(uid, secret);
	if (typeof token !== 'string' || token.length !== expected.length) return false;
	try {
		return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
	} catch (e) {
		return false;
	}
}

async function unsubscribe(uid) {
	await db.setAdd(UNSUB_KEY, String(uid));
	winston.info(`${LOG_PREFIX} User ${uid} unsubscribed from announcement emails.`);
}

async function isUnsubscribed(uid) {
	return await db.isSetMember(UNSUB_KEY, String(uid));
}

async function addBounce(email) {
	await db.setAdd(BOUNCE_KEY, email);
	winston.info(`${LOG_PREFIX} Hard bounce recorded for: ${email}`);
}

async function isBounced(email) {
	return await db.isSetMember(BOUNCE_KEY, email);
}

async function getUnsubscribeHeaders(uid) {
	const url = await getUnsubscribeUrl(uid);
	return {
		'List-Unsubscribe': `<${url}>`,
		'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
	};
}

module.exports = {
	getUnsubscribeUrl,
	getUnsubscribeHeaders,
	verifyToken,
	unsubscribe,
	isUnsubscribed,
	addBounce,
	isBounced,
};
