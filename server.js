// DevBlox AI Server v3.0
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// === alapbeállítások ===
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// === statikus fájlok ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// === főoldal ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Roblox login mock ===
app.get("/login", (req, res) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const redirect = process.env.REDIRECT_URL;
  const url = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&scope=openid%20profile&redirect_uri=${redirect}`;
  res.redirect(url);
});

app.get("/session-status", (req, res) => {
  res.json({
    connected: true,
    user: {
      name: "TesztFelhasználó",
      avatar: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-420x420.png",
    },
  });
});

// === AI generálás ===
let lastCode = null;
app.post("/ai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Hiányzik a prompt!" });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Te egy Roblox fejlesztő AI vagy. Csak LUA kódot írj, magyar kommentekkel, magyarázat nélkül.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 800,
      }),
    });

    const data = await response.json();
    const code = data.choices?.[0]?.message?.content || "-- Hiba: nincs AI válasz --";
    lastCode = code;
    res.json({ success: true, code });
  } catch (err) {
    console.error("AI API hiba:", err);
    res.status(500).json({ error: "AI feldolgozás hiba." });
  }
});

// === AI poll Roblox pluginhez ===
app.get("/ai-poll", (req, res) => {
  if (lastCode) {
    res.json({ code: lastCode });
    lastCode = null;
  } else {
    res.json({});
  }
});

// === HEALTH CHECK (Render) ===
app.get("/health", (req, res) => res.send("✅ Server online"));

// === GOOGLE SHEETS LOG (opcionális) ===
async function logToGoogleSheet(username) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:A",
      valueInputOption: "RAW",
      requestBody: { values: [[username]] },
    });
  } catch (err) {
    console.warn("Nem sikerült logolni Sheets-be:", err.message);
  }
}

// =======================================================
// === QUOTA / NAPI LIMIT (10 free) ======================
function getOrSetUID(req, res) {
  let uid = req.cookies?.db_uid;
  if (!uid) {
    uid = uuidv4();
    res.cookie("db_uid", uid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }
  return uid;
}

const USAGE = new Map(); // { uid: { date, used } }
function today() {
  return new Date().toISOString().slice(0, 10);
}

app.get("/usage", (req, res) => {
  const uid = getOrSetUID(req, res);
  const u = USAGE.get(uid);
  if (!u || u.date !== today()) return res.json({ used: 0 });
  res.json({ used: u.used });
});

app.post("/usage/use", (req, res) => {
  const uid = getOrSetUID(req, res);
  const amt = Math.max(1, Number(req.body?.amount || 1));
  let u = USAGE.get(uid);
  if (!u || u.date !== today()) u = { date: today(), used: 0 };
  if (u.used + amt > 10)
    return res.status(429).json({ error: "Daily quota exceeded" });
  u.used += amt;
  USAGE.set(uid, u);
  res.json({ used: u.used });
});

// =======================================================
// === PLUGIN STATUS (heartbeat) =========================
let PLUGIN_LAST = 0;

app.post("/plugin/heartbeat", (req, res) => {
  PLUGIN_LAST = Date.now();
  res.json({ ok: true });
});

app.get("/plugin/status", (req, res) => {
  const alive = Date.now() - PLUGIN_LAST < 20000; // 20 sec
  res.json({ connected: alive });
});

// =======================================================
// === PROJECTS (dummy lista) ============================
const PROJECTS = [{ id: "p1", name: "New Project" }];

app.get("/projects", (req, res) => res.json(PROJECTS));

app.post("/projects", (req, res) => {
  const id = uuidv4();
  const name = req.body?.name || "Untitled";
  PROJECTS.push({ id, name });
  res.json({ id, name });
});

// =======================================================
app.listen(PORT, () =>
  console.log(`✅ DevBlox AI Server running on port ${PORT}`)
);
