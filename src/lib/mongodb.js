import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable in .env.local'
  );
}

/**
 * Global cache to preserve the mongoose connection across hot reloads
 * in development. In production, each serverless invocation is isolated,
 * so we store the promise on the Node.js global object.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * connectDB() — call this at the top of any API route handler.
 *
 * @returns {Promise<mongoose.Connection>}
 */
export async function connectDB() {
  // Return existing connection immediately if available
  if (cached.conn) {
    return cached.conn;
  }

  // If no pending promise, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable command buffering — fail fast if not connected
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => mongooseInstance.connection);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset the promise so the next call retries the connection
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
