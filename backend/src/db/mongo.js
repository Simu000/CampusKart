// src/db/mongo.js — MongoDB connection manager using Mongoose
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/campus_exchange';

let isConnected = false;

async function connectMongo() {
  if (isConnected) return;

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('✅ MongoDB connected successfully for Private Chat & Messaging at:', MONGO_URI);
  } catch (err) {
    console.warn('⚠️  MongoDB connection warning:', err.message);
    console.warn(`   Target URI: ${MONGO_URI}`);
    console.warn('   To enable MongoDB for private messaging:');
    console.warn('   1. Ensure mongod is running locally (default: mongodb://localhost:27017/campus_exchange)');
    console.warn('      OR provide a MongoDB Atlas cloud URI in your backend/.env (MONGO_URI=...)');
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
});

module.exports = {
  connectMongo,
  mongoose,
};
