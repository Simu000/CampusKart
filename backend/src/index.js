// src/index.js — Express Application Entry Point
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const pool = require("./db/pool");
const { connectMongo } = require("./db/mongo");
const { errorHandler } = require("./middleware/errors");
const { startRequestExpiryJob } = require("./jobs/requestExpiry");
const {
  generalLimiter,
  authLimiter,
  emailLimiter,
  actionLimiter,
} = require("./middleware/rateLimiter");

// Route modules
const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/categories");
const listingRoutes = require("./routes/listings");
const requestRoutes = require("./routes/requests");
const conversationRoutes = require("./routes/conversations");
const userRoutes = require("./routes/users");
const notificationRoutes = require("./routes/notifications");
const reportRoutes = require("./routes/reports");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Uploads directory ─────────────────────────────────────────────────────────
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Global Middleware ─────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.set("trust proxy", 2);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or dev proxy)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly fallback
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file serving for uploaded photos
app.use("/uploads", express.static(uploadsDir));

// ── Rate Limiting ──────────────────────────────────────────────────────────────
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/forgot-password", emailLimiter);
app.use("/api/v1/auth/resend-verification", emailLimiter);
app.use("/api/v1/requests", actionLimiter);
app.use("/api/v1", generalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: process.env.APP_NAME || "Campus Exchange",
    timestamp: new Date().toISOString(),
  });
});

// ── REST API Routes ───────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/listings", listingRoutes);
app.use("/api/v1/requests", requestRoutes);
app.use("/api/v1/conversations", conversationRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/admin", adminRoutes);

// Catch-all 404 for undefined /api routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.path}`,
  });
});

// ── Centralized Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
async function start() {
  try {
    const testConn = await pool.query("SELECT NOW()");
    console.log(
      "✅ PostgreSQL connected successfully at:",
      testConn.rows[0].now,
    );

    // Ensure default status and constraints
    try {
      await pool.query(
        "ALTER TABLE users ALTER COLUMN status SET DEFAULT 'ACTIVE'",
      );
      await pool.query(
        "ALTER TABLE item_requests ALTER COLUMN status SET DEFAULT 'PENDING'",
      );
      await pool.query(
        "ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_qty_total_check; ALTER TABLE listings ADD CONSTRAINT listings_qty_total_check CHECK (qty_total >= 0);",
      );
    } catch (_) {}
  } catch (err) {
    console.warn("PostgreSQL connection failed on startup:", err.message);
    console.warn(
      "   Please check your DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD in .env",
    );
    console.warn(
      '   and run "npm run db:migrate" once the database is online.',
    );
  }

  // Connect to MongoDB for Private Chat & Messaging
  await connectMongo();

  const server = app.listen(PORT, () => {
    console.log(`
Campus Exchange API (Node.js) is running!
   Listening on : http://localhost:${PORT}
   API Base     : http://localhost:${PORT}/api/v1
   Static Files : http://localhost:${PORT}/uploads
   Environment  : ${process.env.NODE_ENV || "development"}
   Frontend URL : ${process.env.FRONTEND_URL || "http://localhost:5173"}
`);
  });

  // Start background cron jobs (72h stale request expiry)
  startRequestExpiryJob();

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down Campus Exchange API...");
    server.close(async () => {
      await pool.end();
      const { mongoose } = require("./db/mongo");
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      console.log("PostgreSQL pool & MongoDB connection closed. Bye!");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (require.main === module) {
  start().catch((err) => {
    console.error("Fatal server startup error:", err);
    process.exit(1);
  });
}

module.exports = app;
module.exports.start = start;
