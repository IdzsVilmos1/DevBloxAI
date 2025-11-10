/* DevBlox AI – Dashboard logic */
const chat = document.getElementById('chat');
const promptInput = document.getElementById('promptInput');
const promptBottom = document.getElementById('promptBottom');
const sendBtn = document.getElementById('sendBtn');
const sendBottom = document.getElementById('sendBottom');

const usesBadge = document.getElementById('usesBadge');
const usesBadgeBottom = document.getElementById('usesBadgeBottom');

const profileMenu = document.getElementById('profileMenu');
const profileDropdown = document.getElementById('profileDropdown');
const usernameEl = document.getElementById('username');
const avatarEl = document.getElementById('avatar');

const upgradeBtn = document.getElementById('upgradeBtn');
const upgradeBtn2 = document.getElementById('upgradeBtn2');
const upgradeModal = document.getElementById('upgradeModal');
const billingModal = document.getElementById('billingModal');
const settingsModal = document.getElementById('settingsModal');
const redeemBtn = document.getElementById('redeemBtn');
const redeemMsg = document.getElementById('redeemMsg');

const pluginDot = document.getElementById('pluginDot');
const pluginText = document.getElementById('pluginText');

let usage = { left: 10, max: 10, plan: 'Free' };

/* ---------- helpers ---------- */
function openModal(id){ document.getElementById(id).style.display='grid'; }
function closeModals(){ document.querySelectorAll('.modal-overlay').forEach(m => m.style.display='none'); }
document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.open)));
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModals));
upgradeBtn?.addEventListener('click', ()=>openModal('upgradeModal'));
upgradeBtn2?.addEventListener('click', ()=>openModal('upgradeModal'));
document.getElementById('goPro')?.addEventListener('click', ()=>alert('Demo: billing provider not wired yet.'));

profileMenu?.addEventListener('click', (e)=> {
  profileMenu.classList.toggle('open');
  e.stopPropagation();
});
document.addEventListener('click', ()=> profileMenu.classList.remove('open'));

/* ---------- session & status ---------- */
async function loadSession() {
  try {
    const res = await fetch('/session-status');
    const data = await res.json();

    if (data?.user) {
      usernameEl.textContent = data.user.name || 'Guest';
      if (data.user.avatar) avatarEl.src = data.user.avatar;
    }

    // optional: server can return usage object {left,max,plan}
    if (data?.usage) usage = data.usage;
    syncUsageBadges();
  } catch (e) {
    console.warn('session-status failed', e);
  }
}
function syncUsageBadges() {
  usesBadge.textContent = `${usage.plan || 'Free'} ${usage.left}/${usage.max} left`;
  usesBadgeBottom.textContent = `${usage.plan || 'Free'} ${usage.left}/${usage.max}`;
}

/* ---------- chat rendering ---------- */
function bubble(who, text, code) {
  const wrap = document.createElement('div');
  wrap.className = 'bubble' + (who === 'me' ? ' me' : '');
  if (who) {
    const w = document.createElement('div');
    w.className = 'who';
    w.textContent = who === 'me' ? 'You' : 'AI';
    wrap.appendChild(w);
  }
  if (text) {
    const p = document.createElement('div');
    p.innerText = text;
    wrap.appendChild(p);
  }
  if (code) {
    const pre = document.createElement('div');
    pre.className = 'code';
    const tb = document.createElement('div');
    tb.className = 'toolbar';
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn'; btnCopy.textContent = 'Copy Lua';
    btnCopy.onclick = () => navigator.clipboard.writeText(code);
    const btnRun = document.createElement('button');
    btnRun.className = 'btn'; btnRun.textContent = 'Send to Studio';
    btnRun.onclick = () => {
      // Optional: if plugin poll is active, we can expose lastCode via /ai-poll
      // In this simple demo we call /ai again with the exact code to keep parity
      fetch('/ai', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt:`-- LUA ONLY\n${code}`})});
      alert('Sent to Studio (if plugin is connected).');
    };
    tb.appendChild(btnCopy);
    tb.appendChild(btnRun);
    const codeBox = document.createElement('pre');
    codeBox.textContent = code;
    pre.appendChild(tb);
    pre.appendChild(codeBox);
    wrap.appendChild(pre);
  }
  chat.appendChild(wrap);
  chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
}

/* ---------- send logic ---------- */
async function send(text) {
  if (!text || !text.trim()) return;
    promptInput.value = "";
    promptBottom.value = "";

  // usage gate
  if (usage.left <= 0) {
    openModal('billingModal');
    return;
  }

  bubble('me', text);
  bubble('', 'Thinking…');

  try {
    const res = await fetch('/ai', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ prompt: text })
    });
    const data = await res.json();

    // remove "Thinking…" (last bubble)
    chat.removeChild(chat.lastElementChild);

    if (data?.code) {
      // try to split plan + lua if the server used the new format
      const txt = data.explainer || 'Here is a plan and code.';
      let lua = data.code;

      // very simple splitter if AI returned combined text
      const m = data.code.match(/```(?:lua)?\s([\s\S]*?)```/i);
      if (m) lua = m[1];

      bubble('ai', txt, lua);
      // decrement usage locally
      usage.left = Math.max(0, usage.left - 1);
      syncUsageBadges();
    } else {
      bubble('ai', '⚠️ No answer from AI.');
    }
  } catch (e) {
    // remove "Thinking…"
    chat.removeChild(chat.lastElementChild);
    bubble('ai', '⚠️ Error talking to AI.');
  }
}

/* ---------- inputs & templates ---------- */
sendBtn?.addEventListener('click', ()=> send(promptInput.value));
sendBottom?.addEventListener('click', ()=> send(promptBottom.value));
promptInput?.addEventListener('keydown', e=> { if(e.key==='Enter') send(promptInput.value); });
promptBottom?.addEventListener('keydown', e=> { if(e.key==='Enter') send(promptBottom.value); });

document.querySelectorAll('.card').forEach(c=>{
  c.addEventListener('click', ()=>{
    if (c.classList.contains('disabled')) return;
    const t = c.dataset.template || c.textContent.trim();
    promptInput.value = t;
    promptInput.focus();
  });
});

/* ---------- redeem "admin" ---------- */
redeemBtn?.addEventListener('click', ()=>{
  const v = document.getElementById('redeemCode').value.trim();
  if (v.toLowerCase() === 'admin') {
    usage.left += 100;
    usage.max += 100;
    syncUsageBadges();
    redeemMsg.textContent = '✅ +100 usage added!';
    redeemMsg.style.color = '#18c67e';
  } else {
    redeemMsg.textContent = '❌ Invalid code';
    redeemMsg.style.color = '#ff7878';
  }
});

/* ---------- faux plugin status (optional) ---------- */
function setPluginConnected(ok){
  pluginDot.style.background = ok ? '#18c67e' : '#ff5f5f';
  pluginText.textContent = ok ? 'Plugin connected' : 'Plugin not connected';
}
// If your plugin pings /plugin/heartbeat, you can toggle this based on a timer or SSE.
// For demo we leave it red:
setPluginConnected(false);

/* ---------- boot ---------- */
loadSession();
// greeting
bubble('ai', 'Welcome! Describe what you want to build. I will propose a short plan and generate Lua code that your Studio plugin can run.');
