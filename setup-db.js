import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('🚀 Setting up database...');

try {
  // Generate migrations
  console.log('📝 Generating migrations...');
  execSync('npm run db:generate', { stdio: 'inherit' });
  
  // Push schema to database
  console.log('📊 Pushing schema to database...');
  execSync('npm run db:push', { stdio: 'inherit' });
  
  // Seed the database
  console.log('🌱 Seeding database...');
  execSync('npm run seed', { stdio: 'inherit' });
  
  console.log('✅ Database setup complete!');
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
  process.exit(1);
} 