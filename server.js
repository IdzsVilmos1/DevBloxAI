// ✅ DevBloxAI szerver (Express + API + weboldal)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch"; // ha a Gemini API-t használod

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// 🧭 Fájl elérési segéd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📁 Statikus fájlok kiszolgálása (itt lesz az index.html)
app.use(express.static(path.join(__dirname, "public")));

// 🌐 Alap oldal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// 🧩 Teszt tároló (ez helyettesíti az AI és Roblox plugin közötti adatot)
let sessions = {};


// 🔹 1. REGISTER - új kapcsolat (pl. Roblox Plugin vagy Web Chat)
app.post("/register", (req, res) => {
  const { projectId } = req.body;
  const sessionId = Math.random().toString(36).substring(2, 10);
  if (!sessions[projectId]) sessions[projectId] = {};
  sessions[projectId][sessionId] = { commands: [] };
  res.json({ sessionId });
  console.log(`🟢 Registered: ${projectId} (${sessionId})`);
});


// 🔹 2. AI - a weboldalról jövő promptokat fogadja
app.post("/ai", async (req, res) => {
  const { projectId, sessionId, prompt } = req.body;
  console.log(`💬 AI prompt: ${prompt}`);

  // Itt lehet majd a Gemini API hívás
  const command = {
    type: "RUN_LUA",
    payload: {
      code: `print("AI válasz a promptra: ${prompt}")`,
    },
  };

  // Továbbítjuk a parancsot a plugin felé
  sessions[projectId][sessionId].commands.push(command);
  res.json({ cmd: command });
});


// 🔹 3. POLL - Roblox plugin ezt hívja, hogy lekérje az AI parancsokat
app.post("/poll", (req, res) => {
  const { projectId, sessionId } = req.body;
  const s = sessions[projectId]?.[sessionId];
  if (!s) return res.json({ commands: [] });

  const cmds = s.commands;
  s.commands = []; // törli, miután elküldte
  res.json({ commands: cmds });
});


// 🚀 Indítás
app.listen(PORT, () => console.log(`✅ DevBloxAI szerver fut a ${PORT} porton`));
