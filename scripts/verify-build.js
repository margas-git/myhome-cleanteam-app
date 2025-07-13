#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying build output...');

const requiredFiles = [
  'dist/server/index.js',
  'client/dist/index.html',
  'client/dist/assets'
];

let allGood = true;

for (const file of requiredFiles) {
  const fullPath = path.resolve(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.error(`❌ ${file} - NOT FOUND`);
    allGood = false;
  }
}

// Check for built assets
const assetsPath = path.resolve(__dirname, '..', 'client/dist/assets');
if (fs.existsSync(assetsPath)) {
  const assets = fs.readdirSync(assetsPath);
  console.log(`📦 Found ${assets.length} built assets`);
  
  // Check for main JS and CSS files
  const hasJS = assets.some(file => file.endsWith('.js'));
  const hasCSS = assets.some(file => file.endsWith('.css'));
  
  if (hasJS) console.log('✅ JavaScript assets found');
  else console.error('❌ No JavaScript assets found');
  
  if (hasCSS) console.log('✅ CSS assets found');
  else console.error('❌ No CSS assets found');
}

if (allGood) {
  console.log('🎉 Build verification passed!');
  process.exit(0);
} else {
  console.error('💥 Build verification failed!');
  process.exit(1);
} 