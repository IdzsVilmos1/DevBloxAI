// 🌐 DevBlox AI v2.4 — Full Stack Server
// Author: IdzsVilmos
// ✅ Roblox Plugin Sync + AI + Status Indicator + Free/Pro System

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Core setup
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// Static folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Global session store
let lastHeartbeat = 0;
let lastCode = null;
let freeUses = 10;

// ============ FRONTEND ROUTES ============
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ============ MOCK LOGIN ============
app.get("/session-status", (req, res) => {
  res.json({
    connected: true,
    user: {
      name: "Guest",
      avatar: "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-420x420.png",
      plan: "Free",
      remaining: freeUses
    }
  });
});

// ============ PLUGIN SYNC ============
app.post("/plugin/heartbeat", (req, res) => {
  lastHeartbeat = Date.now();
  console.log("💓 Plugin heartbeat received:", new Date().toLocaleTimeString());
  res.json({ ok: true });
});

app.get("/plugin/status", (req, res) => {
  const diff = Date.now() - lastHeartbeat;
  const connected = diff < 20000; // plugin is active within 20s
  res.json({ connected });
});

// ============ AI ENDPOINT ============
app.post("/ai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  if (freeUses <= 0) {
    return res.json({
      success: false,
      message: "🔒 Daily limit reached. Upgrade to Pro to continue."
    });
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
            content: "You are DevBlox AI — a Roblox developer assistant. Always reply with Lua scripts, and optionally a short English plan before code."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await response.json();
    const aiReply = data.choices?.[0]?.message?.content || "⚠️ No AI response.";
    freeUses--;

    lastCode = aiReply;
    res.json({ success: true, code: aiReply, remaining: freeUses });
  } catch (err) {
    console.error("AI API error:", err);
    res.status(500).json({ error: "AI generation failed." });
  }
});

app.get("/ai-poll", (req, res) => {
  if (lastCode) {
    res.json({ code: lastCode });
    lastCode = null;
  } else {
    res.json({});
  }
});

// ============ BILLING + ADMIN CODE ============
app.post("/redeem", (req, res) => {
  const { code } = req.body;
  if (code === "admin") {
    freeUses += 100;
    res.json({ success: true, message: "✅ Added 100 AI uses!" });
  } else {
    res.json({ success: false, message: "❌ Invalid code." });
  }
});

// ============ HEALTH ============
app.get("/health", (req, res) => {
  res.send("✅ Server online");
});

// ============ START ============
app.listen(PORT, () => {
  console.log(`✅ DevBlox AI Server running on port ${PORT}`);
});
