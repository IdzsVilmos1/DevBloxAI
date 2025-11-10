// server.js (részlet)
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

const PORT = process.env.PORT || 10000;
const FAKE_LOGIN_ENABLED = true; // ✅ ideiglenes teszt mód engedélyezve

const SESSIONS = new Map();
function createSession(obj = {}) {
  const id = uuid();
  SESSIONS.set(id, { ...obj, created: Date.now() });
  return id;
}

// --- Statikus fájlok ---
app.use(express.static(path.join(__dirname, "public")));

// ---- IDEIGLENES TESZT LOGIN ----
app.get("/login", (req, res) => {
  if (FAKE_LOGIN_ENABLED) {
    const sid = createSession({
      user: {
        name: "DevBlox Tester",
        avatar: "https://tr.rbxcdn.com/30DAY-Avatar.png",
      },
    });
    res.cookie("sess", sid, { httpOnly: true, sameSite: "lax" });
    console.log("🧩 Fake login used → DevBlox Tester");
    return res.redirect("/dashboard");
  }

  // ⚙️ Ha majd éles Roblox OAuth lesz, ide jön vissza az auth flow
  res.redirect("/oauth-not-ready");
});

// --- Session státusz ---
app.get("/session-status", (req, res) => {
  const sessId = req.cookies?.sess;
  if (!sessId || !SESSIONS.has(sessId)) {
    return res.json({ connected: false });
  }
  const sess = SESSIONS.get(sessId);
  return res.json({ connected: !!sess.user, user: sess.user || null });
});

// --- Dashboard elérés ---
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

// --- Logout ---
app.post("/logout", (req, res) => {
  const sessId = req.cookies?.sess;
  if (sessId) {
    SESSIONS.delete(sessId);
    res.clearCookie("sess");
  }
  return res.json({ ok: true });
});

// --- Alapértelmezett útvonal ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`✅ DevBloxAI running on port ${PORT}`));
