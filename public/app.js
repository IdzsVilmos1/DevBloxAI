async function loadSession(){
  const res = await fetch("/session");
  const data = await res.json();
  if(!data.logged) location.href = "/";
  document.getElementById("username").innerText = data.user.name;
  document.getElementById("usageLeft").innerText = 10 - (data.user.uses || 0);
}

async function sendPrompt(){
  const inp = document.getElementById("prompt");
  const resBox = document.getElementById("responseBox");
  const prompt = inp.value.trim();
  if(!prompt) return;
  inp.value = "";
  resBox.innerHTML += `<div class='msg user'>${prompt}</div>`;
  const r = await fetch("/ai", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ prompt }) });
  const data = await r.json();
  if(data.error){
    resBox.innerHTML += `<div class='msg error'>${data.error}</div>`;
  } else {
    resBox.innerHTML += `<div class='msg ai'>${data.reply}</div>`;
    document.getElementById("usageLeft").innerText = data.remaining;
  }
  resBox.scrollTop = resBox.scrollHeight;
}

async function redeemCode(){
  const code = document.getElementById("redeemCode").value.trim();
  const res = await fetch("/redeem", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ code }) });
  const data = await res.json();
  alert(data.msg || "Unknown response");
  loadSession();
}

document.getElementById("sendBtn").onclick = sendPrompt;
document.getElementById("redeemBtn").onclick = redeemCode;
document.getElementById("logoutBtn").onclick = async () => {
  await fetch("/logout", { method:"POST" });
  location.href = "/";
};

loadSession();
