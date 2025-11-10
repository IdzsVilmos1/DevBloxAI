import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";
import { v4 as uuid } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 10000;
const FAKE_LOGIN_ENABLED = true;

const SESSIONS = new Map();

// 📊 Google Sheets setup
let sheets;
try {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const client = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheets = google.sheets({ version: "v4", auth: client });
  console.log("✅ Google Sheets API initialized");
} catch (err) {
  console.error("⚠️ Google Sheets init failed:", err.message);
}

// ✏️ Helper to add a user
async function addUserToSheet(name, avatar) {
  if (!sheets) return;
  try {
    const now = new Date().toLocaleString("hu-HU");
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [[name, avatar, now]],
      },
    });
    console.log(`📝 Added user to sheet: ${name}`);
  } catch (err) {
    console.error("❌ Sheet append failed:", err.message);
  }
}

// 📦 Sessions
function createSession(obj = {}) {
  const id = uuid();
  SESSIONS.set(id, { ...obj, created: Date.now() });
  return id;
}

// 🗂️ Static
app.use(express.static(path.join(__dirname, "public")));

// 🔑 LOGIN (FAKE)
app.get("/login", async (req, res) => {
  if (FAKE_LOGIN_ENABLED) {
    const user = {
      name: "DevBlox Tester",
      avatar: "https://tr.rbxcdn.com/30DAY-Avatar.png",
    };
    const sid = createSession({ user });
    res.cookie("sess", sid, { httpOnly: true, sameSite: "lax" });

    await addUserToSheet(user.name, user.avatar);

    console.log("🧩 Fake login → DevBlox Tester");
    return res.redirect("/dashboard");
  }

  res.redirect("/oauth-not-ready");
});

// 👤 Session info
app.get("/session-status", (req, res) => {
  const sessId = req.cookies?.sess;
  if (!sessId || !SESSIONS.has(sessId)) return res.json({ connected: false });
  const sess = SESSIONS.get(sessId);
  return res.json({ connected: !!sess.user, user: sess.user });
});

// 📊 Dashboard
app.get("/dashboard", (req, res) => {
  const sessId = req.cookies?.sess;
  if (!sessId || !SESSIONS.has(sessId)) return res.redirect("/");
  const sess = SESSIONS.get(sessId);
  if (!sess.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// 🚪 Logout
app.post("/logout", (req, res) => {
  const sessId = req.cookies?.sess;
  if (sessId) {
    SESSIONS.delete(sessId);
    res.clearCookie("sess");
  }
  return res.json({ ok: true });
});

// Default
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`✅ DevBloxAI running on port ${PORT}`));
