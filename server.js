// server.js — DevBlox AI Server (v2.0)
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

// 🔹 Alapbeállítások
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// 📁 Statikus fájlok (frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// 🌐 Fő oldal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- ROBLOX OAUTH + BEJELENTKEZÉS ---
// (Ez majd akkor aktív, ha a Roblox app engedélyezett)
app.get("/login", (req, res) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const redirect = process.env.REDIRECT_URL;
  const url = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&scope=openid%20profile&redirect_uri=${redirect}`;
  res.redirect(url);
});

// 🌍 SESSION STÁTUSZ
app.get("/session-status", (req, res) => {
  // Teszt módban még nincs valódi Roblox login
  res.json({
    connected: true,
    user: {
      name: "TesztFelhasználó",
      avatar: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-420x420.png"
    }
  });
});

// --- AI ENDPOINT (OpenAI hívás) ---
app.post("/ai", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Hiányzik a prompt!" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Te egy Roblox fejlesztő AI vagy. Csak LUA kódot írj, magyar kommentekkel, magyarázat nélkül."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 800
      })
    });

    const data = await response.json();
    const aiReply = data.choices?.[0]?.message?.content || "⚠️ Nem jött válasz az AI-tól.";

    res.json({ success: true, code: aiReply });
  } catch (err) {
    console.error("AI API hiba:", err);
    res.status(500).json({ error: "AI feldolgozás hiba." });
  }
});

// --- HEALTH CHECK (Renderhez) ---
app.get("/health", (req, res) => {
  res.send("✅ Server online");
});

// --- GOOGLE SHEETS (opcionális logolás) ---
async function logToGoogleSheet(username) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:A",
      valueInputOption: "RAW",
      requestBody: { values: [[username]] }
    });
  } catch (err) {
    console.warn("Nem sikerült logolni Google Sheets-be:", err.message);
  }
}

// --- INDÍTÁS ---
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
