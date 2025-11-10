// public/app.js
async function qs(s){return document.querySelector(s)}
const dot = await qs("#dot");
const statusText = await qs("#statusText");
const sessionText = await qs("#sessionText");
const logEl = await qs("#log");
const sendBtn = await qs("#sendBtn");
const promptInput = await qs("#prompt");
const logoutBtn = await qs("#logoutBtn");
const loginBtn = await qs("#loginBtn");

function appendLine(txt){
  const p = document.createElement("div");
  p.textContent = txt;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

async function refreshStatus(){
  try{
    const r = await fetch("/session-status");
    const j = await r.json();
    if(j.connected){
      dot.classList.add("green");
      statusText.textContent = "Csatlakozva a Roblox Studio-hoz!";
      sessionText.textContent = `Session: ${j.sessionId || "—"}`;
      appendLine("• connected: " + (j.sessionId || ""));
    } else {
      dot.classList.remove("green");
      statusText.textContent = "Nem csatlakozott";
      sessionText.textContent = "";
    }
  } catch(e){
    dot.classList.remove("green");
    statusText.textContent = "Hálózati hiba";
  }
}

refreshStatus();
setInterval(refreshStatus, 8000);

sendBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if(!prompt) return;
  appendLine("Te: " + prompt);
  promptInput.value = "";
  try {
    const r = await fetch("/ai", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({prompt})
    });
    const j = await r.json();
    appendLine("AI: " + (j.text || JSON.stringify(j).slice(0,300)));
  } catch (err) {
    appendLine("Hiba: " + err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  await refreshStatus();
});

