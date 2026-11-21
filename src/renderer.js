'use strict';

const api = window.jarvis;
const root = document.getElementById('hologram');
const caption = document.getElementById('caption');
const badge = document.getElementById('badge');
const bars = [...document.querySelectorAll('.wave i')];
const signal = document.getElementById('signal');

let state = { listening: false, speaking: false, active: false, caption: '' };

function setState(next) {
  state = { ...state, ...next };
  root.classList.toggle('listening', state.listening || state.active);
  root.classList.toggle('speaking', state.speaking);
  root.classList.toggle('thinking', state.active && !state.speaking);
  root.classList.toggle('off', !state.listening && !state.active);
  badge.textContent = state.speaking ? 'FALANDO' : state.active ? 'ATIVO' : state.listening ? 'OUVIDO' : 'OFF';
  if (state.caption) caption.textContent = state.caption;
  animateWave();
}

function animateWave() {
  const level = state.speaking ? 14 : state.listening ? 11 : 4;
  let total = 0;
  bars.forEach((bar, index) => {
    const random = state.listening || state.speaking ? Math.random() : 0;
    const height = 4 + Math.round(random * level * (0.5 + Math.sin(index + Date.now() / 200) * 0.5));
    bar.style.height = `${height}px`;
    total += height;
  });
  if (signal) signal.textContent = `SIGNAL ${String(Math.round((total / bars.length) * 7)).padStart(2, '0')}`;
}

setInterval(animateWave, 120);

root.addEventListener('click', () => api?.toggle());
root.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  api?.menu();
});

if (api) {
  api.onState(setState);
  api.status().then(setState).catch(() => {});
}
