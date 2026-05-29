const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const endpointEl = document.getElementById('endpoint');
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

async function getReply(message) {
  const endpoint = endpointEl.value.trim();
  if (!endpoint) {
    const lower = message.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi')) return 'I am here. The hands free loop is working.';
    if (lower.includes('stop')) return 'Say stop again or press the stop button to end the session.';
    return `I heard: ${message}. Connect an agent endpoint to make this a real live assistant.`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);
  const data = await res.json();
  return data.reply || data.message || data.text || 'No reply field returned.';
}

function startRecognition() {
  if (!SpeechRecognition) {
    setStatus('SpeechRecognition is not supported in this browser. Use Chrome/Edge desktop or Android Chrome.', '');
    addMsg('err', 'Browser does not support Web Speech Recognition.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = navigator.language || 'en-US';

  recognition.onstart = () => setStatus('Listening...', 'listening');
  recognition.onerror = e => addMsg('err', `Speech recognition error: ${e.error}`);
  recognition.onend = () => {
    if (running && !speaking) {
      try { recognition.start(); } catch {}
    }
  };

  recognition.onresult = async event => {
    const result = event.results[event.results.length - 1];
    if (!result.isFinal || speaking) return;
    const text = result[0].transcript.trim();
    if (!text) return;

    addMsg('me', text);
    setStatus('Thinking...', '');

    // Avoid the mic hearing the assistant voice.
    try { recognition.stop(); } catch {}

    try {
      const reply = await getReply(text);
      addMsg('ai', reply);
      await speak(reply);
    } catch (err) {
      addMsg('err', err.message || String(err));
      await speak('I hit an endpoint error. Check the server URL.');
    }

    if (running) {
      setTimeout(() => { try { recognition.start(); } catch {} }, 250);
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
