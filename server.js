// server.js — DevBloxAI v2.1
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());
app.use(cookieParser());

// === Állapot mentés (session + használat) ===
const usersFile = "./users.json";
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
}
function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// === statikus fájlok ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// === fake login rendszer ===
app.post("/login", (req, res) => {
  const id = "user_" + Date.now();
  users[id] = users[id] || { name: "Guest_" + Math.floor(Math.random() * 9999), uses: 0 };
  saveUsers();
  res.cookie("session", id, { httpOnly: false });
  res.json({ ok: true, user: users[id] });
});

app.post("/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

app.get("/session", (req, res) => {
  const id = req.cookies.session;
  if (!id || !users[id]) return res.json({ logged: false });
  res.json({ logged: true, user: users[id] });
});

// === használat számláló + admin kód ===
app.post("/redeem", (req, res) => {
  const id = req.cookies.session;
  const code = (req.body.code || "").trim().toLowerCase();
  if (!id || !users[id]) return res.status(401).json({ error: "Not logged in" });
  if (code === "admin") {
    users[id].uses = Math.max(0, users[id].uses - 100);
    saveUsers();
    return res.json({ ok: true, msg: "+100 usage unlocked!" });
  }
  res.json({ ok: false, msg: "Invalid code" });
});

// === AI végpont (OpenAI API) ===
app.post("/ai", async (req, res) => {
  const id = req.cookies.session;
  if (!id || !users[id]) return res.status(401).json({ error: "Not logged in" });

  const user = users[id];
  if (user.uses >= 10) return res.json({ error: "Usage limit reached (10/day)" });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are DevBloxAI, an advanced Roblox development assistant. Reply with both explanation and Lua code if needed." },
          { role: "user", content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 600
      })
    });
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || "⚠️ No reply.";

    user.uses++;
    saveUsers();

    res.json({ success: true, reply, remaining: 10 - user.uses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI request failed" });
  }
});

// === healthcheck ===
app.get("/health", (req, res) => res.send("✅ DevBloxAI online"));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// --- PLUGIN HEARTBEAT / STATUS ---
// Ez frissíti a Roblox plugin kapcsolatot

let lastHeartbeat = 0;

app.post("/plugin/heartbeat", (req, res) => {
  lastHeartbeat = Date.now();
  console.log("💓 Heartbeat received at", new Date(lastHeartbeat).toLocaleTimeString());
  res.json({ ok: true });
});

app.get("/plugin/status", (req, res) => {
  const diff = Date.now() - lastHeartbeat;
  const connected = diff < 20000; // 20 másodpercig zöld
  res.json({ connected });
});

