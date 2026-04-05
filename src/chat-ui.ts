export function chatHTML(wsPort: number): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OpenCode Chat</title>
<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-dim: #8b949e;
    --accent: #58a6ff;
    --accent-dim: #1f6feb;
    --green: #3fb950;
    --orange: #d29922;
    --red: #f85149;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 13px;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    display: flex;
  }

  /* Sidebar */
  #sidebar {
    width: 240px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--surface);
  }
  #sidebar-header {
    padding: 12px;
    border-bottom: 1px solid var(--border);
    font-weight: bold;
    color: var(--accent);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #sidebar-header span { font-size: 11px; color: var(--text-dim); }
  #session-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }
  .session-item {
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .session-item:hover { background: var(--border); color: var(--text); }
  .session-item.active { background: var(--accent-dim); color: var(--text); }

  /* Main area */
  #main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Header bar */
  #header {
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
  }
  #status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  #status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--red);
  }
  #status-dot.connected { background: var(--green); }
  #status-dot.busy { background: var(--orange); }
  #session-info { color: var(--text-dim); font-size: 12px; }

  /* Messages */
  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .msg {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 8px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg.user {
    align-self: flex-end;
    background: var(--accent-dim);
    color: var(--text);
  }
  .msg.assistant {
    align-self: flex-start;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .msg.tool {
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--border);
    border-left: 3px solid var(--orange);
    font-size: 12px;
    color: var(--text-dim);
    padding: 6px 10px;
  }
  .msg.system {
    align-self: center;
    background: transparent;
    color: var(--text-dim);
    font-size: 11px;
    padding: 4px 8px;
  }
  .msg .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-dim);
    margin-bottom: 4px;
  }
  .msg.assistant .label { color: var(--green); }
  .msg.tool .label { color: var(--orange); }
  .streaming { border-color: var(--accent); }

  /* Input */
  #input-area {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    gap: 8px;
  }
  #input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: inherit;
    font-size: 13px;
    padding: 10px 12px;
    resize: none;
    outline: none;
    min-height: 40px;
    max-height: 120px;
  }
  #input:focus { border-color: var(--accent); }
  #send-btn {
    background: var(--accent-dim);
    color: var(--text);
    border: none;
    border-radius: 6px;
    padding: 0 16px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: bold;
  }
  #send-btn:hover { background: var(--accent); }
  #send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-header">
    OpenCode Chat
    <span>fakechat</span>
  </div>
  <div id="session-list"></div>
</div>

<div id="main">
  <div id="header">
    <div id="status">
      <div id="status-dot"></div>
      <span id="status-text">Disconnected</span>
    </div>
    <div id="session-info">No session</div>
  </div>

  <div id="messages"></div>

  <div id="input-area">
    <textarea id="input" rows="1" placeholder="Type a message..." disabled></textarea>
    <button id="send-btn" disabled>Send</button>
  </div>
</div>

<script>
const WS_URL = "ws://" + location.hostname + ":" + ${wsPort} + "/ws";
let ws;
let currentSession = null;
let reconnectTimer = null;

const $messages = document.getElementById("messages");
const $input = document.getElementById("input");
const $sendBtn = document.getElementById("send-btn");
const $statusDot = document.getElementById("status-dot");
const $statusText = document.getElementById("status-text");
const $sessionInfo = document.getElementById("session-info");
const $sessionList = document.getElementById("session-list");

function connect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    setStatus("connected", "Connected");
    $input.disabled = false;
    $sendBtn.disabled = false;
    ws.send(JSON.stringify({ type: "list_sessions" }));
  };

  ws.onclose = () => {
    setStatus("disconnected", "Disconnected");
    $input.disabled = true;
    $sendBtn.disabled = true;
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => ws.close();

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    handleMessage(msg);
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case "sessions":
      renderSessions(msg.sessions);
      break;
    case "session_created":
      currentSession = msg.sessionID;
      $sessionInfo.textContent = "Session: " + msg.sessionID.slice(0, 8);
      addMsg("system", "Session created");
      ws.send(JSON.stringify({ type: "list_sessions" }));
      break;
    case "session_status":
      const statusMap = { idle: "connected", busy: "busy" };
      setStatus(statusMap[msg.status] || "connected", msg.status.charAt(0).toUpperCase() + msg.status.slice(1));
      break;
    case "assistant_text":
      appendOrUpdateAssistant(msg.messageID, msg.text, msg.streaming);
      break;
    case "tool_start":
      addMsg("tool", "\\u25b6 " + msg.tool + (msg.title ? ": " + msg.title : ""));
      break;
    case "tool_end":
      addMsg("tool", "\\u2714 " + msg.tool + " completed");
      break;
    case "error":
      addMsg("system", "Error: " + msg.message);
      break;
    case "prompt_done":
      setStatus("connected", "Idle");
      break;
  }
}

function renderSessions(sessions) {
  $sessionList.innerHTML = "";
  for (const s of sessions) {
    const el = document.createElement("div");
    el.className = "session-item" + (s.id === currentSession ? " active" : "");
    el.textContent = s.title || s.id.slice(0, 12);
    el.onclick = () => switchSession(s.id);
    $sessionList.appendChild(el);
  }
}

function switchSession(id) {
  currentSession = id;
  $sessionInfo.textContent = "Session: " + id.slice(0, 8);
  $messages.innerHTML = "";
  addMsg("system", "Switched to session " + id.slice(0, 8));
  ws.send(JSON.stringify({ type: "switch_session", sessionID: id }));
  ws.send(JSON.stringify({ type: "list_sessions" }));
}

function setStatus(cls, text) {
  $statusDot.className = cls;
  $statusText.textContent = text;
}

const assistantMsgs = new Map();

function appendOrUpdateAssistant(messageID, text, streaming) {
  let el = assistantMsgs.get(messageID);
  if (!el) {
    el = document.createElement("div");
    el.className = "msg assistant";
    el.innerHTML = '<div class="label">assistant</div><div class="content"></div>';
    $messages.appendChild(el);
    assistantMsgs.set(messageID, el);
  }
  el.querySelector(".content").textContent = text;
  if (streaming) {
    el.classList.add("streaming");
  } else {
    el.classList.remove("streaming");
    assistantMsgs.delete(messageID);
  }
  scrollBottom();
}

function addMsg(role, text) {
  const el = document.createElement("div");
  el.className = "msg " + role;
  if (role === "user") {
    el.textContent = text;
  } else {
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = role;
    el.appendChild(label);
    const content = document.createElement("div");
    content.className = "content";
    content.textContent = text;
    el.appendChild(content);
  }
  $messages.appendChild(el);
  scrollBottom();
}

function scrollBottom() {
  $messages.scrollTop = $messages.scrollHeight;
}

function send() {
  const text = $input.value.trim();
  if (!text || !ws || ws.readyState !== 1) return;
  addMsg("user", text);
  ws.send(JSON.stringify({ type: "prompt", text, sessionID: currentSession }));
  $input.value = "";
  $input.style.height = "auto";
  setStatus("busy", "Thinking...");
}

$sendBtn.onclick = send;
$input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
$input.addEventListener("input", () => {
  $input.style.height = "auto";
  $input.style.height = Math.min($input.scrollHeight, 120) + "px";
});

connect();
</script>
</body>
</html>`;
}
