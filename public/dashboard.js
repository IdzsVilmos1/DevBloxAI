const chatLog = document.getElementById("chatLog");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const quotaBadge = document.getElementById("quotaBadge");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const heroPrompt = document.getElementById("heroPrompt");
const heroGo = document.getElementById("heroGo");
const pluginDot = document.getElementById("pluginDot");
const pluginText = document.getElementById("pluginText");
const upgradeModal = document.getElementById("upgradeModal");
const closeUpgrade = document.getElementById("closeUpgrade");
const logoutBtn = document.getElementById("logoutBtn");
const projectList = document.getElementById("projectList");

const avatar = document.getElementById("avatar");
const displayName = document.getElementById("displayName");

function addMsg(who, text) {
  const msg = document.createElement("div");
  msg.className = "msg " + (who === "me" ? "me" : "ai");
  msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHtml(s){return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Load session (name + avatar)
async function loadSession() {
  const s = await fetchJSON("/session-status");
  if (s.user) {
    displayName.textContent = s.user.name || "User";
    avatar.src = s.user.avatar || "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-420x420.png";
    connDot.classList.remove("red"); connDot.classList.add("green");
    connText.textContent = "Connected";
  }
}

// Load plugin status
async function loadPlugin() {
  try {
    const p = await fetchJSON("/plugin/status");
    if (p.connected) {
      pluginDot.classList.remove("red"); pluginDot.classList.add("green");
      pluginText.textContent = "Plugin connected";
    } else {
      pluginDot.classList.remove("green"); pluginDot.classList.add("red");
      pluginText.textContent = "Plugin not connected";
    }
  } catch (e) {}
}

// Usage / quota
async function loadQuota() {
  const u = await fetchJSON("/usage");
  quotaBadge.textContent = `Free ${u.used}/10 left`;
}

async function decrementOrBlock() {
  const u = await fetchJSON("/usage");
  if (u.used >= 10) {
    upgradeModal.classList.remove("hidden");
    return false;
  }
  await fetchJSON("/usage/use", { method: "POST", body: JSON.stringify({ amount: 1 }) });
  quotaBadge.textContent = `Free ${u.used + 1}/10 left`;
  return true;
}

// Projects
async function loadProjects() {
  const p = await fetchJSON("/projects");
  projectList.innerHTML = "";
  p.forEach(pr => {
    const li = document.createElement("li");
    li.textContent = pr.name;
    projectList.appendChild(li);
  });
}

async function sendPrompt(text) {
  if (!text.trim()) return;
  const ok = await decrementOrBlock();
  if (!ok) return;

  addMsg("me", text);
  promptEl.value = "";
  heroPrompt.value = "";
  const res = await fetchJSON("/ai", { method: "POST", body: JSON.stringify({ prompt: text }) });
  addMsg("ai", res.code || "—");
}

sendBtn.onclick = () => sendPrompt(promptEl.value);
promptEl.addEventListener("keydown", e => { if (e.key === "Enter") sendPrompt(promptEl.value); });
heroGo.onclick = () => sendPrompt(heroPrompt.value);

closeUpgrade.onclick = () => upgradeModal.classList.add("hidden");
logoutBtn.onclick = async () => { await fetch("/logout", { method: "POST" }); location.href = "/"; };

// bootstrap
(async () => {
  await loadSession();
  await loadPlugin();
  await loadQuota();
  await loadProjects();
  addMsg("ai","Szia! Írj le egy mechanikát (pl. 'inventory rendszer'), és kódot küldök a Roblox Studio pluginnek.");
})();
