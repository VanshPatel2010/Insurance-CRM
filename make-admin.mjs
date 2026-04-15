import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
}

// Import Agent model
import Agent from './src/models/Agent.js';

async function makeAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI environment variable is not set');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const result = await Agent.updateOne(
      { email: 'test@1.com' },
      { $set: { isAdmin: true } }
    );

    console.log('Update result:', result);
    
    if (result.matchedCount === 0) {
      console.log('❌ No agent found with email: test@1.com');
    } else if (result.modifiedCount === 1) {
      console.log('✅ Successfully made test@1.com an admin');
    } else {
      console.log('⚠️ Agent already had isAdmin set to true');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

makeAdmin();
