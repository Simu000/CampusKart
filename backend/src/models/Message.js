// src/models/Message.js — Mongoose Model for Private Chat Messages
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    requestId: {
      type: Number,
      required: true,
      index: true,
    },
    senderId: {
      type: Number,
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

// Compound index for querying chronological message thread by requestId
messageSchema.index({ requestId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
