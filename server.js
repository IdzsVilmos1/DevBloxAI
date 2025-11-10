import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PROJECTS = new Map();
const GEMINI_KEY = process.env.GEMINI_KEY;
const GEMINI_MODEL = "gemini-1.5-flash";

function getProject(projectId) {
  if (!PROJECTS.has(projectId)) PROJECTS.set(projectId, { sessions: new Map() });
  return PROJECTS.get(projectId);
}

app.post("/register", (req, res) => {
  const { projectId, studioInfo } = req.body;
  const sessionId = uuid();
  const project = getProject(projectId);
  project.sessions.set(sessionId, { queue: [], info: studioInfo || {} });
  res.json({ sessionId });
});

app.post("/poll", async (req, res) => {
  const { projectId, sessionId } = req.body;
  const project = getProject(projectId);
  const sess = project.sessions.get(sessionId);
  if (!sess) return res.status(404).json({ error: "session not found" });
  if (sess.queue.length > 0) {
    const cmds = sess.queue.splice(0, sess.queue.length);
    return res.json({ commands: cmds });
  }
  await new Promise(r => setTimeout(r, 2000));
  res.json({ commands: [] });
});

app.post("/push", (req, res) => {
  const { projectId, sessionId, type, payload } = req.body;
  const project = getProject(projectId);
  const sess = project.sessions.get(sessionId);
  if (!sess) return res.status(404).json({ error: "session not found" });
  const cmd = { id: uuid(), type, payload, ts: Date.now() };
  sess.queue.push(cmd);
  res.json({ ok: true });
});

app.post("/ai", async (req, res) => {
  const { prompt, projectId, sessionId } = req.body;
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
                {
                  text: `You are an assistant controlling Roblox Studio. Respond ONLY in JSON with {type, payload}. The request: ${prompt}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const json = await aiRes.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let cmd;
    try {
      cmd = JSON.parse(text);
    } catch {
      cmd = { type: "RUN_LUA", payload: { code: `-- invalid JSON\nprint("AI error")` } };
    }

    const project = getProject(projectId);
    const sess = project.sessions.get(sessionId);
    if (sess) sess.queue.push({ id: uuid(), ...cmd, ts: Date.now() });

    res.json({ ok: true, cmd });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error", detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ AI Remote Server running on port ${PORT}`));
