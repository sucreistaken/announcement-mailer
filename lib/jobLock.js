'use strict';

// Simple in-memory mutex for preventing concurrent operations on the same job
const locks = new Map();

function acquire(jobId) {
	if (locks.has(jobId)) return false;
	locks.set(jobId, Date.now());
	return true;
}

function release(jobId) {
	locks.delete(jobId);
}

function isLocked(jobId) {
	return locks.has(jobId);
}

module.exports = { acquire, release, isLocked };
