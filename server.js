// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";
import { v4 as uuid } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// ---- CONFIG from env ----
const PORT = process.env.PORT || 10000;
const GEMINI_KEY = process.env.GEMINI_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// OAuth config (configure these in your hosting secrets)
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || "";
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || "";
const OAUTH_CALLBACK = process.env.OAUTH_CALLBACK || "";
const OAUTH_AUTHORIZE_URL = process.env.OAUTH_AUTHORIZE_URL || ""; // e.g. "https://www.roblox.com/oauth/authorize"
const OAUTH_TOKEN_URL = process.env.OAUTH_TOKEN_URL || "";         // e.g. "https://www.roblox.com/oauth/token"
const OAUTH_SCOPES = process.env.OAUTH_SCOPES || "openid profile"; // set appropriate scopes

// In-memory store (simple). Production: használj DB-t vagy Redis-t.
const SESSIONS = new Map(); // sessionId -> { oauthToken, oauthRefresh, profile, created }

function createSession(obj = {}) {
  const id = uuid();
  SESSIONS.set(id, { ...obj, created: Date.now() });
  return id;
}

// Serve static UI
app.use(express.static(path.join(__dirname, "public")));

// ---- OAuth: redirect to provider ----
app.get("/login", (req, res) => {
  // create a short session and store a state token
  const state = uuid();
  const sessionId = createSession({ state });
  // set a cookie so browser keeps sessionId
  res.cookie("sess", sessionId, { httpOnly: true, sameSite: "lax" });

  // build authorization URL
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK,
    response_type: "code",
    scope: OAUTH_SCOPES,
    state
  });
  const url = `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  return res.redirect(url);
});

// ---- OAuth callback ----
app.get("/oauth/callback", async (req, res) => {
  const { code, state } = req.query;
  const sessionId = req.cookies?.sess;
  if (!sessionId || !SESSIONS.has(sessionId)) {
    return res.status(400).send("Session missing.");
  }
  const sess = SESSIONS.get(sessionId);
  if (!state || state !== sess.state) {
    return res.status(400).send("Invalid state.");
  }
  if (!code) return res.status(400).send("No code returned.");

  try {
    // Exchange code for token
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

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, text);
      return res.status(500).send("Token exchange failed.");
    }

    const tokenJson = await tokenRes.json();
    // tokenJson expected: access_token, refresh_token, expires_in, etc.
    sess.oauth = tokenJson;
    SESSIONS.set(sessionId, sess);

    // Optionally fetch user profile from provider (if provider offers endpoint)
    // For Roblox you might have an endpoint to get current user; configure PROFILE_URL as env if desired.

    // redirect back to frontend app
    return res.redirect("/");
  } catch (err) {
    console.error(err);
    return res.status(500).send("OAuth callback error.");
  }
});

// ---- session status endpoint (used by client js) ----
app.get("/session-status", (req, res) => {
  const sessionId = req.cookies?.sess;
  if (!sessionId) return res.json({ connected: false });
  const sess = SESSIONS.get(sessionId);
  if (!sess) return res.json({ connected: false });
  // return minimal info
  return res.json({ connected: !!sess.oauth, sessionId, info: { created: sess.created } });
});

// ---- logout
app.post("/logout", (req, res) => {
  const sessionId = req.cookies?.sess;
  if (sessionId) {
    SESSIONS.delete(sessionId);
    res.clearCookie("sess");
  }
  res.json({ ok: true });
});

// ---- AI endpoint (example, keep your existing logic) ----
app.post("/ai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "missing prompt" });
  if (!GEMINI_KEY) return res.status(500).json({ error: "no GEMINI_KEY configured" });

  try {
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `You are an assistant controlling Roblox Studio. Respond only in JSON.\nRequest: ${prompt}` }
              ]
            }
          ]
        })
      }
    );

    const json = await aiRes.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(json);
    return res.json({ ok: true, raw: json, text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI error", detail: err.message });
  }
});

// ---- keep your other API endpoints too (register/poll/push) if needed ----
app.post("/register", (req, res) => {
  // minimal example: return session id
  const sessionId = createSession({ queue: [] });
  res.json({ sessionId });
});

app.post("/poll", async (req, res) => {
  // simple poll impl for plugin (you can expand)
  const { sessionId } = req.body;
  const sess = SESSIONS.get(sessionId);
  if (!sess) return res.status(404).json({ error: "session not found" });
  const cmds = sess.queue?.splice(0) || [];
  res.json({ commands: cmds });
});

app.post("/push", (req, res) => {
  const { sessionId, type, payload } = req.body;
  const sess = SESSIONS.get(sessionId);
  if (!sess) return res.status(404).json({ error: "session not found" });
  sess.queue = sess.queue || [];
  const cmd = { id: uuid(), type, payload, ts: Date.now() };
  sess.queue.push(cmd);
  res.json({ ok: true });
});

// fallback: serve index for SPA routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// start
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Static public at ${path.join(__dirname, "public")}`);
});
