// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ========= Config ========= */
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "techflair.db");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

/* Default Admin (nur wenn keiner existiert) */
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com";
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "Default Admin";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "admin1234";

/* ========= Middlewares ========= */
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static website (Multi-Page from /public)
app.use(express.static(path.join(__dirname, "public")));

// Simple in-memory rate limit (IP-based)
const hitMap = new Map();
app.use((req, res, next) => {
  const key = `${req.ip}:${new Date().toISOString().slice(0, 16)}`; // per minute
  hitMap.set(key, (hitMap.get(key) || 0) + 1);
  if (hitMap.get(key) > 200) {
    return res.status(429).json({ error: "Too many requests" });
  }
  next();
});

/* ========= DB ========= */
let db;
async function initDb() {
  // Ensure DB directory exists
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  // --- Fallback-Admin nur wenn keiner existiert ---
  const existingAdmin = await db.get("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (!existingAdmin) {
    const password_hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await db.run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)",
      [DEFAULT_ADMIN_NAME.trim(), DEFAULT_ADMIN_EMAIL.toLowerCase().trim(), password_hash, "admin"]
    );
    console.log("⚠️ Default Admin erstellt:",
      `${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD} (bitte ändern)`);
  } else {
    console.log("Admin vorhanden – kein Default-Admin angelegt.");
  }

  console.log("DB ready at:", DB_PATH);
}

/* ========= Helpers ========= */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
function authRequired(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/* ========= Routes ========= */

// Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: !!db, time: new Date().toISOString() });
});

// Register (public) -> immer role=user
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
    if (password.length < 4) return res.status(400).json({ error: "Weak password" });

    const password_hash = await bcrypt.hash(password, 10);
    const role = "user";

    const result = await db.run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)",
      [name.trim(), email.toLowerCase().trim(), password_hash, role]
    );

    const user = { id: result.lastID, name: name.trim(), email: email.toLowerCase().trim(), role };
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    if (String(e?.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const row = await db.get("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!row) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Me
app.get("/api/me", authRequired, async (req, res) => {
  const row = await db.get(
    "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
    [req.user.sub]
  );
  res.json({ user: row || null });
});

// Admin: list users
app.get("/api/users", authRequired, requireRole("admin"), async (req, res) => {
  const users = await db.all(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 500"
  );
  res.json({ users });
});

// Admin: create user (role=user|admin)
app.post("/api/users", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
    const r = (role || "user").toLowerCase();
    if (!["user", "admin"].includes(r)) return res.status(400).json({ error: "Invalid role" });
    if (password.length < 8) return res.status(400).json({ error: "Password too short (min 8)" });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)",
      [name.trim(), email.toLowerCase().trim(), password_hash, r]
    );
    const user = { id: result.lastID, name: name.trim(), email: email.toLowerCase().trim(), role: r };
    res.status(201).json({ user });
  } catch (e) {
    if (String(e?.message || "").includes("UNIQUE")) {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: delete user
app.delete("/api/users/:id", authRequired, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });
  if (id === req.user.sub) return res.status(400).json({ error: "Cannot remove self" });

  const result = await db.run("DELETE FROM users WHERE id = ?", [id]);
  res.json({ deleted: result.changes || 0 });
});

// NOTE: Kein SPA-Fallback -> Multi-Page funktioniert out of the box

/* ========= Boot ========= */
initDb()
  .then(() =>
    app.listen(PORT, () =>
      console.log(`TechFlair server running → http://localhost:${PORT}`)
    )
  )
  .catch((err) => {
    console.error("DB init failed", err);
    process.exit(1);
  });
