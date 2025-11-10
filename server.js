// DevBlox AI Server v3.1
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// === LOGIN MOCK ===
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
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

// =========================================================
// === 🧠 UNIVERSAL AI HANDLER ==============================
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
            content: `
Te egy fejlett Roblox AI fejlesztő asszisztens vagy.
A felhasználó bármit kérhet, ami Roblox Studio-ban létrehozható vagy scriptelhető:
- GUI elemek (ScreenGui, Frame, TextLabel, ImageButton, stb.)
- Workspace objectek (Part, MeshPart, Model, Light, ParticleEmitter, stb.)
- Animációk, tweenek, mozgás, pathfinding
- Interaktív rendszerek (ajtó, bolt, inventory, UI)
- Fegyver, NPC, AI, hangok, effektek
- Sőt, teljes rendszerek: quest, wave, crafting stb.

Mindig az alábbi formátumban válaszolj:

🧩 **Leírás (Amilyen nyelven kérték tőled)** — röviden mit fog csinálni  
🧱 **CREATE:** objektumok, amiket létre kell hozni  
⚙️ **SET:** property-k, pozíciók, színek, tween stb.  
📜 **LUA:** Lua / Luau script (kommentekkel magyarul)  

Formátum példa:
---
🧩 Leírás: Készítek egy ajtót, ami kinyílik, ha a player rákattint.

-- CREATE:
Part "Door"
ClickDetector "Click"
Script "DoorScript"

-- SET:
Door.Position = Vector3.new(0,5,0)
Door.Anchored = true
Door.Size = Vector3.new(4,8,1)
Door.Color = Color3.fromRGB(120,80,40)

-- LUA:
local door = script.Parent
local click = door:WaitForChild("Click")
click.MouseClick:Connect(function()
    local TweenService = game:GetService("TweenService")
    local tween = TweenService:Create(door, TweenInfo.new(1), {CFrame = door.CFrame * CFrame.Angles(0, math.rad(90), 0)})
    tween:Play()
end)
---
Mindig ebben a formában adj választ.
`
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    const code = data.choices?.[0]?.message?.content || "-- Nincs AI válasz --";
    lastCode = code;
    res.json({ success: true, code });
  } catch (err) {
    console.error("AI API hiba:", err);
    res.status(500).json({ error: "AI feldolgozás hiba." });
  }
});

// Plugin poll (Roblox studio lekérés)
app.get("/ai-poll", (req, res) => {
  if (lastCode) {
    res.json({ code: lastCode });
    lastCode = null;
  } else {
    res.json({});
  }
});

// =========================================================
// === DAILY USAGE LIMIT (10 free) ==========================
function getOrSetUID(req, res) {
  let uid = req.cookies?.db_uid;
  if (!uid) {
    uid = uuidv4();
    res.cookie("db_uid", uid, { httpOnly: true, sameSite: "lax", maxAge: 1000*60*60*24*365 });
  }
  return uid;
}
const USAGE = new Map();
function today() { return new Date().toISOString().slice(0,10); }

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
  if (u.used + amt > 10) return res.status(429).json({ error: "Daily quota exceeded" });
  u.used += amt;
  USAGE.set(uid, u);
  res.json({ used: u.used });
});

// =========================================================
// === PLUGIN STATUS (heartbeat) ===========================
let PLUGIN_LAST = 0;
app.post("/plugin/heartbeat", (req, res) => {
  PLUGIN_LAST = Date.now();
  res.json({ ok: true });
});
app.get("/plugin/status", (req, res) => {
  const alive = Date.now() - PLUGIN_LAST < 20000;
  res.json({ connected: alive });
});

// =========================================================
// === PROJECTS =============================================
const PROJECTS = [{ id: "p1", name: "New Project" }];
app.get("/projects", (req, res) => res.json(PROJECTS));
app.post("/projects", (req, res) => {
  const id = uuidv4();
  const name = req.body?.name || "Untitled";
  PROJECTS.push({ id, name });
  res.json({ id, name });
});

// =========================================================
app.listen(PORT, () => console.log(`✅ DevBlox AI running on port ${PORT}`));
