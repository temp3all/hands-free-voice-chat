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
    if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getReply(message) {
  const endpoint = endpointEl.value.trim();
  if (!endpoint) {
    const lower = message.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi')) return 'I am here. The hands free loop is working.';
    if (lower.includes('stop')) return 'Say stop again or press the stop button to end the session.';
    return `I heard: ${message}. Connect an agent endpoint to make this a real live assistant.`;
  }

  const chat = await postJson(endpoint, { message, password: passwordEl.value });
  if (!chat.id || !chat.pending) return chat.reply || chat.message || chat.text || 'No reply field returned.';

  addMsg('ai', chat.reply || 'Sent. Waiting for Telegram reply...');
  setStatus('Waiting for Telegram reply...', '');
  const replyUrl = endpoint.replace(/\/chat\/?$/, '/reply');
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500));
    const data = await postJson(replyUrl, { id: chat.id, password: passwordEl.value }, 15000);
    if (!data.pending) return data.reply || 'Reply received.';
  }
  return 'No Telegram reply yet.';
}

function startRecognition() {
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
    addMsg('err', `Speech recognition error: ${e.error}`);
    if (running && !speaking) {
      setTimeout(() => { try { recognition.start(); } catch {} }, 500);
    }
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
      const msg = `${err.name || 'Error'}: ${err.message || String(err)}. Endpoint: ${endpointEl.value.trim()}`;
      addMsg('err', msg);
      await speak('I hit an endpoint fetch error.');
    }

      if (running) {
        setTimeout(() => { try { recognition.start(); } catch {} }, 250);
      }
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
