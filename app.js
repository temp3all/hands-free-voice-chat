const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const endpointEl = document.getElementById('endpoint');
const passwordEl = document.getElementById('password');
const orb = document.getElementById('orb');

let recognition;
let running = false;
let speaking = false;

function addMsg(kind, text) {
  const div = document.createElement('div');
  div.className = `msg ${kind}`;
  div.textContent = `${kind === 'me' ? 'You' : kind === 'ai' ? 'Agent' : 'System'}: ${text}`;
  logEl.prepend(div);
}

function setStatus(text, mode = '') {
  statusEl.textContent = text;
  orb.className = `orb ${mode}`;
}

function requirePassword() {
  const v = passwordEl.value.trim();
  if (!v) {
    setStatus('Paste access password first.', '');
    addMsg('err', 'Access password required before starting.');
    passwordEl.focus();
    return false;
  }
  return true;
}

function speak(text) {
  return new Promise(resolve => {
    synth.cancel();
    speaking = true;
    setStatus('Speaking...', 'speaking');
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05;
    utter.pitch = 1;
    utter.onend = () => { speaking = false; resolve(); };
    utter.onerror = () => { speaking = false; resolve(); };
    synth.speak(utter);
  });
}

async function postJson(url, payload, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Endpoint returned ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getReply(message) {
  const endpoint = endpointEl.value.trim();
  if (!endpoint) return `I heard: ${message}. No endpoint is set.`;

  const password = passwordEl.value.trim();
  if (!password) throw new Error('Missing access password');

  const chat = await postJson(endpoint, { message, password });
  if (!chat.id || !chat.pending) return chat.reply || chat.message || chat.text || 'No reply field returned.';

  addMsg('ai', chat.reply || 'Sent. Waiting for Telegram reply...');
  setStatus('Waiting for Telegram reply...', '');
  const replyUrl = endpoint.replace(/\/chat\/?$/, '/reply');
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500));
    const data = await postJson(replyUrl, { id: chat.id, password }, 15000);
    if (!data.pending) return data.reply || 'Reply received.';
  }
  return 'No Telegram reply yet.';
}

function startRecognition() {
  if (!requirePassword()) return;
  if (!SpeechRecognition) {
    setStatus('SpeechRecognition is not supported in this browser. Use Chrome/Edge desktop or Android Chrome.', '');
    addMsg('err', 'Browser does not support Web Speech Recognition.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  recognition.onstart = () => setStatus('Listening...', 'listening');
  recognition.onerror = e => {
    if (e.error !== 'aborted') addMsg('err', `Speech recognition error: ${e.error}`);
    if (running && !speaking) setTimeout(() => { try { recognition.start(); } catch {} }, 500);
  };
  recognition.onend = () => {
    if (running && !speaking) {
      try { recognition.start(); } catch {}
    }
  };

  let finalText = '';
  recognition.onresult = async event => {
    const result = event.results[event.results.length - 1];
    if (speaking) return;

    if (result.isFinal) {
      finalText = (finalText + ' ' + result[0].transcript).trim();
      const text = finalText.trim();
      finalText = '';
      if (!text) return;

      addMsg('me', text);
      setStatus('Thinking...', '');
      try { recognition.stop(); } catch {}

      try {
        const reply = await getReply(text);
        addMsg('ai', reply);
        await speak(reply);
      } catch (err) {
        const endpoint = endpointEl.value.trim();
        const msg = `${err.name || 'Error'}: ${err.message || String(err)}. Endpoint: ${endpoint}`;
        addMsg('err', msg);
        await speak('I hit an endpoint fetch error.');
      }

      if (running) setTimeout(() => { try { recognition.start(); } catch {} }, 250);
    }
  };

  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  recognition.start();
}

function stopRecognition() {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  synth.cancel();
  try { recognition && recognition.stop(); } catch {}
  setStatus('Stopped.', '');
}

startBtn.addEventListener('click', startRecognition);
stopBtn.addEventListener('click', stopRecognition);
