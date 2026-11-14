// src/models/Conversation.js — Mongoose Model for Private Chat Conversations
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    requestId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    listingId: {
      type: Number,
      required: true,
      index: true,
    },
    listingTitle: {
      type: String,
      default: '',
    },
    buyerId: {
      type: Number,
      required: true,
      index: true,
    },
    buyerName: {
      type: String,
      default: 'Student',
    },
    sellerId: {
      type: Number,
      required: true,
      index: true,
    },
    sellerName: {
      type: String,
      default: 'Student',
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// Indexes for user's conversation list lookup
conversationSchema.index({ buyerId: 1, updatedAt: -1 });
conversationSchema.index({ sellerId: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
