#!/usr/bin/env node

/**
 * Updates the CACHE_VERSION in service-worker.js with current timestamp
 * Run this script before deploying to ensure cache busting
 */

const fs = require('fs');
const path = require('path');

const serviceWorkerPath = path.join(__dirname, 'service-worker.js');
const currentTimestamp = new Date().toISOString();

// Read the service worker file
let content = fs.readFileSync(serviceWorkerPath, 'utf8');

// Update the version with current timestamp
content = content.replace(
    /const CACHE_VERSION = '[^']+';/,
    `const CACHE_VERSION = '${currentTimestamp}';`
);

// Write back to file
fs.writeFileSync(serviceWorkerPath, content, 'utf8');

console.log(`✓ Updated service worker cache version to: ${currentTimestamp}`);
