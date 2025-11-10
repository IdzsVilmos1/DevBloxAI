// server.js
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

// ---- Roblox OAuth Config ----
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const OAUTH_CALLBACK = process.env.OAUTH_CALLBACK;
const OAUTH_AUTHORIZE_URL = "https://apis.roblox.com/oauth/v1/authorize";
const OAUTH_TOKEN_URL = "https://apis.roblox.com/oauth/v1/token";
const OAUTH_USERINFO_URL = "https://apis.roblox.com/oauth/v1/userinfo";
const OAUTH_SCOPES = "openid profile";

// ---- Google Sheets Config ----
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// ---- In-memory sessions ----
const SESSIONS = new Map();

function createSession(obj = {}) {
  const id = uuid();
  SESSIONS.set(id, { ...obj, created: Date.now() });
  return id;
}

// ---- Helper: Google Sheets write ----
async function writeToSheet(username) {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_SHEET_ID) {
    console.log("⚠️ Google Sheets nincs konfigurálva");
    return;
  }
  const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: "A:A",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [[username]] },
  });
  console.log(`🟢 Mentve Google Sheet-be: ${username}`);
}

// ---- Serve static files ----
app.use(express.static(path.join(__dirname, "public")));

// ---- Login redirect ----
app.get("/login", (req, res) => {
  const state = uuid();
  const sessionId = createSession({ state });
  res.cookie("sess", sessionId, { httpOnly: true, sameSite: "lax" });

  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK,
    response_type: "code",
    scope: OAUTH_SCOPES,
    state
  });

  res.redirect(`${OAUTH_AUTHORIZE_URL}?${params.toString()}`);
});

// ---- OAuth callback ----
app.get("/oauth/callback", async (req, res) => {
  const { code, state } = req.query;
  const sessId = req.cookies?.sess;
  if (!sessId || !SESSIONS.has(sessId)) {
    return res.status(400).send("Invalid session");
  }
  const sess = SESSIONS.get(sessId);
  if (sess.state !== state) {
    return res.status(400).send("Invalid state");
  }
  try {
    // Token exchange
    const tokenRes = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: OAUTH_CALLBACK,
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET
      })
    });
    const tokens = await tokenRes.json();
    sess.tokens = tokens;

    // Get user info
    const infoRes = await fetch(OAUTH_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const user = await infoRes.json();

    sess.user = {
      name: user.name,
      avatar: user.picture,
      sub: user.sub
    };
    SESSIONS.set(sessId, sess);

    await writeToSheet(user.name);

    // Redirect to dashboard
    return res.redirect("/dashboard");
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.status(500).send("OAuth callback error");
  }
});

// ---- Session status for frontend ----
app.get("/session-status", (req, res) => {
  const sessId = req.cookies?.sess;
  if (!sessId || !SESSIONS.has(sessId)) {
    return res.json({ connected: false });
  }
  const sess = SESSIONS.get(sessId);
  return res.json({ connected: !!sess.user, user: sess.user || null });
});

// ---- Logout ----
app.post("/logout", (req, res) => {
  const sessId = req.cookies?.sess;
  if (sessId) {
    SESSIONS.delete(sessId);
    res.clearCookie("sess");
  }
  return res.json({ ok: true });
});

// ---- Route handling ----
app.get("/dashboard", (req, res) => {
  const sessId = req.cookies?.sess;
  if (!sessId || !SESSIONS.has(sessId)) {
    return res.redirect("/");
  }
  const sess = SESSIONS.get(sessId);
  if (!sess.user) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Fallback: anything else → index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- Start server ----
app.listen(PORT, () => {
  console.log(`✅ DevBloxAI running on port ${PORT}`);
});
