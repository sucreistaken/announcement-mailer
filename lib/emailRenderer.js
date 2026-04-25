'use strict';

const meta = require.main.require('./src/meta');
const nconf = require.main.require('nconf');

// Only system-controlled URLs and dates are safe — user-supplied content is always escaped
const SAFE_VARIABLES = new Set(['siteName', 'siteUrl', 'date', 'topicUrl', 'unsubscribeUrl']);

function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHtml(templateHtml, variables) {
	let result = templateHtml;
	for (const [key, value] of Object.entries(variables)) {
		const placeholder = new RegExp(`\\{${escapeRegex(key)}\\}`, 'g');
		const safeValue = SAFE_VARIABLES.has(key)
			? String(value || '')
			: escapeHtml(String(value || ''));
		result = result.replace(placeholder, safeValue);
	}
	return result;
}

function renderPlainText(html) {
	let text = html;
	text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
	text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
	text = text.replace(/<br\s*\/?>/gi, '\n');
	text = text.replace(/<\/p>/gi, '\n\n');
	text = text.replace(/<\/div>/gi, '\n');
	text = text.replace(/<\/h[1-6]>/gi, '\n\n');
	text = text.replace(/<\/li>/gi, '\n');
	text = text.replace(/<\/tr>/gi, '\n');
	text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)');
	text = text.replace(/<[^>]+>/g, '');
	text = text.replace(/&amp;/g, '&');
	text = text.replace(/&lt;/g, '<');
	text = text.replace(/&gt;/g, '>');
	text = text.replace(/&quot;/g, '"');
	text = text.replace(/&#39;/g, "'");
	text = text.replace(/&nbsp;/g, ' ');
	text = text.replace(/[ \t]+/g, ' ');
	text = text.replace(/\n{3,}/g, '\n\n');
	return text.trim();
}

function getDefaultVariables() {
	const locale = meta.config.defaultLang || 'tr-TR';
	return {
		siteName: meta.config.title || 'Forum',
		siteUrl: nconf.get('url') || '',
		date: new Date().toLocaleDateString(locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		}),
	};
}

function escapeHtml(str) {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

module.exports = {
	renderHtml,
	renderPlainText,
	getDefaultVariables,
	escapeHtml,
};
