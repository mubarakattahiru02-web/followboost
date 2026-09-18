import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const { Pool } = pg;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

app.get("/api/health", async (req, res) => {
  res.json({ ok: true, app: "FollowBoost", version: "1.0.0" });
});

app.post("/api/signup", async (req, res) => {
  const { name, email, password, deviceId } = req.body;
  if (!name || !email || !password || !deviceId) return res.status(400).json({ error: "All fields are required." });
  if (!pool) return res.status(503).json({ error: "Database is not configured yet." });

  try {
    const emailHash = hash(email.trim().toLowerCase());
    const deviceHash = hash(deviceId);
    const duplicate = await pool.query(
      "SELECT id FROM users WHERE email_hash=$1 OR device_hash=$2 LIMIT 1",
      [emailHash, deviceHash]
    );
    if (duplicate.rowCount) return res.status(409).json({ error: "This email or device is already registered." });

    const result = await pool.query(
      "INSERT INTO users(name,email_hash,password_hash,device_hash,points) VALUES($1,$2,$3,$4,0) RETURNING id,name,points,created_at",
      [name.trim(), emailHash, hash(password), deviceHash]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || !pool) return res.status(400).json({ error: "Email and password are required." });
  try {
    const result = await pool.query(
      "SELECT id,name,points,created_at FROM users WHERE email_hash=$1 AND password_hash=$2 LIMIT 1",
      [hash(email.trim().toLowerCase()), hash(password)]
    );
    if (!result.rowCount) return res.status(401).json({ error: "Invalid login details." });
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/stats", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY || !pool) return res.status(403).json({ error: "Forbidden." });
  try {
    const users = await pool.query("SELECT COUNT(*)::int AS total_users FROM users");
    const points = await pool.query("SELECT COALESCE(SUM(points),0)::int AS total_points FROM users");
    res.json({ totalUsers: users.rows[0].total_users, totalPoints: points.rows[0].total_points });
  } catch {
    res.status(500).json({ error: "Could not load statistics." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FollowBoost running on port ${port}`));