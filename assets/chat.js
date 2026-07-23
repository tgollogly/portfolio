/* =====================================================================
   chat.js — the site-wide AI assistant.
   Loaded by EVERY page. Injects its own markup and styles, so the
   widget looks and behaves identically everywhere. All colour comes
   from site.css tokens — nothing is hardcoded.
   Also fills any <span class="footyr"> / #yr with the current year.
   ===================================================================== */
(function () {
  "use strict";

  /* ---- footer year, sitewide ---- */
  var y = new Date().getFullYear();
  document.querySelectorAll(".footyr").forEach(function (e) { e.textContent = y; });
  var yr = document.getElementById("yr"); if (yr) yr.textContent = y;

  /* ---- don't inject twice ---- */
  if (document.getElementById("chatBtn")) return;

  var css = document.createElement("style");
  css.textContent = [
    '#chatBtn{position:fixed;bottom:22px;right:22px;z-index:80;background:var(--accent);color:#fff;border:none;border-radius:999px;padding:14px 20px;font-family:var(--sans);font-weight:600;font-size:14.5px;box-shadow:0 8px 24px rgba(47,57,201,.4);cursor:pointer;display:flex;align-items:center;gap:9px;transition:transform .15s,background .2s;}',
    '#chatBtn:hover{transform:translateY(-2px);background:var(--accent-2);}',
    '#chatPanel{position:fixed;bottom:88px;right:22px;z-index:80;width:min(370px,calc(100vw - 44px));height:min(520px,calc(100vh - 130px));background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 50px rgba(15,20,23,.25);display:none;flex-direction:column;overflow:hidden;}',
    '#chatPanel.open{display:flex;}',
    '.chat-head{background:var(--accent);color:#fff;padding:15px 18px;display:flex;justify-content:space-between;align-items:center;}',
    '.chat-head b{font-family:var(--serif);font-size:16px;font-weight:600;}',
    '.chat-head span{font-size:12px;opacity:.9;}',
    '.chat-x{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;}',
    '.chat-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--bg-alt);}',
    '.bub{max-width:82%;padding:10px 13px;border-radius:14px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;}',
    '.bub.bot{background:var(--card);border:1px solid var(--line);color:var(--ink);align-self:flex-start;border-bottom-left-radius:4px;}',
    '.bub.me{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}',
    '.chat-foot{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line);background:var(--card);}',
    '.chat-foot input{flex:1;border:1px solid var(--line-2);border-radius:10px;padding:11px 13px;font-family:var(--sans);font-size:14.5px;color:var(--ink);background:var(--card);}',
    '.chat-foot input:focus{outline:2px solid var(--accent);outline-offset:1px;}',
    '.chat-foot button{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:600;font-family:var(--sans);cursor:pointer;}',
    '.chat-foot button:hover{background:var(--accent-2);}',
    '.typing{font-size:13px;color:var(--faint);align-self:flex-start;padding:4px 6px;}',
    '@media print{#chatBtn,#chatPanel{display:none!important;}}'
  ].join("");
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "chatBtn";
  btn.setAttribute("aria-label", "Open chat");
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "\uD83D\uDCAC Ask about me";

  var panel = document.createElement("div");
  panel.id = "chatPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat assistant");
  panel.innerHTML =
    '<div class="chat-head"><div><b>Ask about Thomas</b><br><span>AI assistant \u00b7 answers about my work</span></div>' +
    '<button class="chat-x" id="chatX" aria-label="Close">&times;</button></div>' +
    '<div class="chat-body" id="chatBody"></div>' +
    '<div class="chat-foot"><input id="chatInput" type="text" placeholder="e.g. What can Thomas build?" autocomplete="off" aria-label="Message"/>' +
    '<button id="chatSend">Send</button></div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var body = panel.querySelector("#chatBody"),
      input = panel.querySelector("#chatInput"),
      send = panel.querySelector("#chatSend");
  var history = [], greeted = false;

  function add(text, who) {
    var d = document.createElement("div");
    d.className = "bub " + (who === "user" ? "me" : "bot");
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    add("Hi! I'm Thomas's AI assistant. Ask about his skills, projects or how to get in touch. (I use AI \u2014 your messages go to Google's Gemini API and aren't stored here; please don't share anything confidential.)", "bot");
  }

  btn.onclick = function () {
    var open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { greet(); input.focus(); }
  };
  panel.querySelector("#chatX").onclick = function () {
    panel.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    btn.focus();
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  async function sendMsg() {
    var msg = input.value.trim();
    if (!msg) return;
    add(msg, "user");
    history.push({ role: "user", text: msg });
    input.value = "";
    if (!window.AI_BACKEND_URL) {
      add("Chat isn't switched on just now \u2014 please email Thomas at thomas@tgollogly.dev.", "bot");
      return;
    }
    var t = document.createElement("div");
    t.className = "typing";
    t.textContent = "typing\u2026";
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
    try {
      var r = await fetch(window.AI_BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", message: msg, history: history })
      });
      var d = await r.json();
      t.remove();
      var reply = d.reply || d.error || "Sorry, I couldn't answer that.";
      add(reply, "bot");
      history.push({ role: "assistant", text: reply });
    } catch (e) {
      t.remove();
      add("I couldn't reach the assistant just now. Email Thomas at thomas@tgollogly.dev.", "bot");
    }
  }

  send.onclick = sendMsg;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendMsg(); });
})();
