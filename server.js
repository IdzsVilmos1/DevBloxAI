// server.js — DevBlox AI Server (v2.1)
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

app.use(express.json());
app.use(cors());
app.use(cookieParser());

// 📁 Frontend statikus fájlok
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// 🌐 Főoldal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🌍 Teszt login (fake)
app.get("/session-status", (req, res) => {
  res.json({
    connected: true,
    user: {
      name: "TesztFelhasználó",
      avatar: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-420x420.png"
    }
  });
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

// --- AI + POLL rendszer ---
let lastCode = null;

app.post("/ai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Hiányzik a prompt!" });

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
            content: "Te egy Roblox fejlesztő AI vagy. Csak LUA kódot írj, magyar kommentekkel, magyarázat nélkül."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 800
      })
    });

    const data = await response.json();
    const code = data.choices?.[0]?.message?.content || "-- Hiba: nincs AI válasz --";

    lastCode = code; // 💾 eltároljuk a legutóbbi kódot a plugin számára

    res.json({ success: true, code });
  } catch (err) {
    console.error("AI API hiba:", err);
    res.status(500).json({ error: "AI feldolgozás hiba." });
  }
});

// --- Roblox plugin lekérdezés ---
app.get("/ai-poll", (req, res) => {
  if (lastCode) {
    res.json({ code: lastCode });
    lastCode = null;
  } else {
    res.json({});
  }
});

// --- Health check ---
app.get("/health", (req, res) => {
  res.send("✅ Server online");
});

// --- Indítás ---
app.listen(PORT, () => console.log(`✅ DevBloxAI server running on port ${PORT}`));
