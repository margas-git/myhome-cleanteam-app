#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Setting up database...');

try {
  // Generate migrations
  console.log('📝 Generating migrations...');
  execSync('npx drizzle-kit generate:pg', { 
    stdio: 'inherit',
    cwd: __dirname 
  });

  // Push schema to database
  console.log('📊 Pushing schema to database...');
  execSync('npx drizzle-kit push:pg', { 
    stdio: 'inherit',
    cwd: __dirname 
  });

  // Seed the database
  console.log('🌱 Seeding database...');
  execSync('node server/seed.ts', { 
    stdio: 'inherit',
    cwd: __dirname 
  });

  console.log('✅ Database setup completed successfully!');
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
  process.exit(1);
} 