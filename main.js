'use strict';

const {
  app, BrowserWindow, ipcMain, globalShortcut, Menu, screen
} = require('electron');
const path = require('path');

const store = require('./lib/store');
const brain = require('./lib/brain');
const engine = require('./lib/engine');
const speech = require('./lib/speech');
const tts = require('./lib/tts');
const actions = require('./lib/actions');
const websearch = require('./lib/websearch');

let hologram = null;
let listening = false;
let voiceEnabled = true;
let conversationTimer = null;
let wakePrimed = false;
let lastWeakAt = 0;

const conversation = {
  active: false,
  lastInput: '',
  lastReply: '',
  lastTopic: '',
  lastResults: [],
  resultIndex: 0
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// O texto do Vosk é normalizado (sem acentos) antes da checagem.
const { WAKE_PATTERN, WAKE_HINT } = require('./lib/wake');

function pushState(patch = {}) {
  const status = brain.status();
  hologram?.webContents.send('state', {
    listening,
    speaking: tts.speaking,
    active: conversation.active,
    webLearned: status.webLearned,
    interactions: status.interactions,
    ...patch
  });
}

function setActive(value) {
  conversation.active = Boolean(value);
  clearTimeout(conversationTimer);
  if (conversation.active) {
    conversationTimer = setTimeout(() => {
      conversation.active = false;
      wakePrimed = false;
      pushState({ caption: `Voltando ao modo de espera. ${WAKE_HINT}.` });
    }, 60000);
  }
  pushState();
}

function answer(text, options = {}) {
  const falar = options.forceSpeak || voiceEnabled;
  if (falar) tts.speak(text);
  else tts.stop();
  conversation.lastReply = text;
  pushState({ caption: text.slice(0, 90), speaking: falar });
}

function applyWrite(write) {
  if (!write) return;
  const key = write.store === 'notes' ? 'notes' : 'tasks';
  const current = store[key]().get('items') || [];
  store[key]().set({ items: [write.item, ...current].slice(0, 200) });
}

function readList(type) {
  const key = type === 'tasksList' ? 'tasks' : 'notes';
  const items = store[key]().get('items') || [];
  if (!items.length) return 'Não há itens salvos.';
  return items.slice(0, 5).map((item, index) => `${type === 'tasksList' ? `${index + 1}: ` : ''}${item.text}${item.done ? ', concluída' : ''}`).join('. ');
}

function finishTask(query) {
  const all = store.tasks().get('items') || [];
  const q = String(query || '').toLocaleLowerCase('pt-BR');
  const index = /^\d+$/.test(q) ? Number(q) - 1 : all.findIndex((item) => item.text.toLocaleLowerCase('pt-BR').includes(q));
  if (index >= 0 && all[index]) {
    all[index].done = true;
    store.tasks().set({ items: all });
    return `Tarefa concluída: ${all[index].text}.`;
  }
  return 'Não encontrei essa tarefa.';
}

function isFollowUp(text) {
  return /^(mais|continue|continua|conte mais|explique melhor|explica melhor|detalhe mais|e aí|e ai|por que|como assim|qual foi|repita|repete|de novo|outra vez)/.test(text);
}

async function followUp(text) {
  if (/^(repita|repete|de novo|outra vez)/.test(text)) {
    answer(conversation.lastReply ? `Repetindo: ${conversation.lastReply}` : 'Não há nada para repetir.');
    return;
  }
  if (conversation.lastResults.length > conversation.resultIndex) {
    const next = conversation.lastResults[conversation.resultIndex];
    conversation.resultIndex += 1;
    answer(`Mais um trecho: ${next.snippet || next.title}`);
    return;
  }
  if (/^(por que|como assim)/.test(text) && conversation.lastResults[0]) {
    answer(`O trecho que encontrei diz: ${conversation.lastResults[0].snippet || conversation.lastResults[0].title}`);
    return;
  }
  if (conversation.lastTopic) {
    const again = engine.parse(`explicar ${conversation.lastTopic}`);
    if (again.reply && !again.webSearch) {
      answer(again.reply);
      return;
    }
  }
  answer(conversation.lastReply ? `Como eu disse: ${conversation.lastReply}` : 'Não tenho mais detalhes sobre isso.');
}

async function respondTo(raw) {
  const text = String(raw || '').trim();
  if (!text) return;
  conversation.lastInput = text;
  clearTimeout(conversationTimer);
  pushState({ caption: `Você: ${text}`, speaking: false, listening: true });

  // brain.norm remove acentos e pontuação: "pare.", "silêncio!",
  // "tudo bem, para de falar" e "canalize" também interrompem a fala.
  // A âncora evita capturar "para que serve o git" como comando de parada.
  if (/^(?:tudo bem|ok|agora)?\s*(?:pare|para|espera|silencio|basta|canalize|cancelar)(?:\s+de\s+falar)?$/.test(brain.norm(text))) {
    tts.stop();
    setActive(false);
    answer(`Tudo bem. ${WAKE_HINT} quando quiser.`);
    return;
  }

  if (isFollowUp(engine.norm(text)) && conversation.active) {
    await followUp(engine.norm(text));
    setActive(true);
    return;
  }

  let parsed;
  try {
    parsed = engine.parse(text);
  } catch (error) {
    answer(`Houve um erro ao interpretar: ${error.message}`);
    return;
  }

  const setting = parsed.setting;
  if (setting) {
    store.settings().set(setting);
    // Antes essas chaves eram só salvas: o assistente dizia "Microfone
    // desligado" mas continuava ouvindo / falando. Agora aplicamos de fato.
    if ('microphoneMuted' in setting) toggleListening(!setting.microphoneMuted, true);
  }
  applyWrite(parsed.write);

  let spoken = parsed.reply || '';
  if (parsed.data?.type === 'notesList' || parsed.data?.type === 'tasksList') {
    spoken = readList(parsed.data.type);
  } else if (parsed.data?.type === 'taskDone') {
    spoken = finishTask(parsed.data.query);
  }

  if (parsed.action) {
    const settings = store.settings().get();
    if (!settings.allowActions) {
      spoken += ' Ações no Windows estão desativadas.';
    } else {
      if (!settings.requireConfirmation || (settings.trustedActions || []).includes(parsed.action.type)) {
        try {
          if (parsed.action.type === 'typeText' || parsed.action.type === 'hotkey') {
            hologram?.minimize();
            await delay(600);
          }
          const done = await actions.execute(parsed.action);
          spoken += ` ${done}`;
        } catch (error) {
          spoken += ` Não consegui executar: ${error.message}`;
        } finally {
          if (hologram && !hologram.isDestroyed()) {
            hologram.restore();
            hologram.focus();
          }
        }
      } else {
        // Antes a ação era silenciosamente ignorada enquanto a fala dizia
        // "Vou bloquear o Windows". Nunca afirmar que executou algo que não foi.
        spoken += ' Essa ação pede confirmação e não foi executada.';
      }
    }
  }

  if (parsed.webSearch?.query) {
    try {
      const found = await websearch.search(parsed.webSearch.query, { limit: 10 });
      const saved = found.length ? brain.learnWeb(parsed.webSearch.query, found) : 0;
      const shown = found.slice(0, 3);
      spoken = websearch.speakable(shown, parsed.webSearch.query, saved);
      conversation.lastTopic = parsed.webSearch.query;
      conversation.lastResults = shown;
      conversation.resultIndex = 1;
    } catch (error) {
      spoken = `Não consegui consultar a web agora. ${error.message}`;
    }
    delete parsed.webSearch;
  } else {
    conversation.lastTopic = /^(explicar|o que e|me conte sobre|o que voce sabe sobre)\s+(.+)$/.test(engine.norm(text))
      ? engine.norm(text).replace(/^(explicar|o que e|me conte sobre|o que voce sabe sobre)\s+/, '')
      : conversation.lastTopic;
    conversation.lastResults = [];
    conversation.resultIndex = 0;
  }

  if (parsed.intent === 'system' && parsed.system === 'quit') {
    answer(spoken);
    setTimeout(() => app.quit(), 1800);
    return;
  }

  if (brain.isEnabled()) brain.recordInteraction(text, spoken);

  if (setting && 'voiceEnabled' in setting) {
    const next = Boolean(setting.voiceEnabled);
    // Se o comando foi "desativar voz", fala a confirmação uma última vez
    // e só então silencia — o usuário precisa saber que o comando funcionou.
    const confirmaSilencio = voiceEnabled && !next;
    voiceEnabled = next;
    if (!next && !confirmaSilencio) tts.stop();
    answer(spoken, { forceSpeak: confirmaSilencio });
  } else {
    answer(spoken);
  }
  setActive(true);
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  const size = 210;
  hologram = new BrowserWindow({
    width: size,
    height: size,
    x: Math.max(0, area.x + area.width - size - 18),
    y: area.y + 18,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  hologram.loadFile(path.join(__dirname, 'src', 'index.html'));
  hologram.on('closed', () => { hologram = null; });
  hologram.webContents.on('context-menu', () => showMenu());
}

function showMenu() {
  const template = [
    { label: listening ? 'Desligar microfone' : 'Ligar microfone', click: () => toggleListening() },
    { label: 'Parar de falar', click: () => tts.stop() },
    { type: 'separator' },
    { label: 'Treinar base local', click: () => {
      const report = brain.ingestTraining(require('./lib/training-data'));
      answer(report.reply);
    } },
    { label: 'Limpar memória', click: () => {
      const report = brain.clearMemory();
      answer(report.reply);
    } },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ];
  Menu.buildFromTemplate(template).popup({ window: hologram });
}

function toggleListening(force, silent = false) {
  const next = typeof force === 'boolean' ? force : !listening;
  if (next) {
    speech.start();
    listening = true;
    if (!silent) answer(`Microfone ativado. ${WAKE_HINT} para começar.`);
  } else {
    speech.stop();
    tts.stop();
    listening = false;
    wakePrimed = false;
    setActive(false);
    pushState({ caption: 'Microfone desligado', speaking: false });
  }
  pushState();
}

function registerIpc() {
  ipcMain.handle('voice:toggle', () => { toggleListening(); return listening; });
  ipcMain.handle('voice:status', () => ({ listening, active: conversation.active, speaking: tts.speaking }));
  ipcMain.handle('voice:ask', (_event, text) => respondTo(text));
  ipcMain.handle('brain:status', () => brain.status());
  ipcMain.handle('brain:clear', () => brain.clearMemory());
  ipcMain.handle('brain:train', () => brain.ingestTraining(require('./lib/training-data')));
  ipcMain.on('menu:show', () => showMenu());
}

function registerSpeech() {
  speech.on('ready', () => pushState({ caption: WAKE_HINT }));
  speech.on('partial', (text) => {
    if (!text) return;
    // Ativação detectada ainda durante a fala: resposta visual, sem falar,
    // para não silenciar o microfone enquanto o comando está sendo dito.
    if (!conversation.active && WAKE_PATTERN.test(engine.norm(text))) {
      wakePrimed = true;
      setActive(true);
      pushState({ caption: 'Sim? Pode falar.' });
      return;
    }
    pushState({ caption: `Ouvindo: ${text}` });
  });
  speech.on('final', (text) => {
    if (!text) return;
    const cleanText = String(text).trim();
    const normalized = engine.norm(cleanText);
    const hasWake = WAKE_PATTERN.test(normalized);
    const wasAwake = wakePrimed || conversation.active;
    wakePrimed = false;

    if (!wasAwake && !hasWake) {
      pushState({ caption: `Ouvi: ${cleanText}. ${WAKE_HINT}.` });
      return;
    }

    const command = hasWake
      ? normalized.replace(WAKE_PATTERN, '').replace(/^[\s,:;-]+/, '').trim()
      : normalized;
    if (!command) {
      setActive(true);
      pushState({ caption: 'Sim? Pode falar.' });
      return;
    }

    respondTo(command);
  });
  speech.on('weak', (text) => {
    if (!conversation.active || !text || Date.now() - lastWeakAt < 5000) return;
    lastWeakAt = Date.now();
    pushState({ caption: `Não ouvi bem: ${text}. Pode repetir?` });
    answer('Não ouvi bem. Pode repetir?');
  });
  speech.on('error', (message) => {
    console.error('[VOSK]', message);
    pushState({ caption: `Vosk: ${String(message).slice(0, 60)}` });
  });
  speech.on('status', (state) => {
    // Se o reconhecedor desistiu (running:false), a variável de controle
    // também precisa cair — senão o próximo clique desliga algo já desligado.
    if (!state.running) {
      listening = false;
      wakePrimed = false;
    }
    pushState({ listening: state.running && listening });
  });
}

app.whenReady().then(() => {
  brain.attachPersistence({ load: () => store.brainMemory().get(), save: (data) => store.brainMemory().set(data) });
  // O comando por voz salva em brain.json; o boot antes lia só settings.json
  // e reativava o cérebro contra a vontade do usuário a cada reinício.
  const savedBrain = store.brainMemory().get();
  const brainAtivo = typeof savedBrain.profile?.enabled === 'boolean'
    ? savedBrain.profile.enabled
    : Boolean(store.settings().get().brain?.enabled ?? true);
  brain.setEnabled(brainAtivo);
  store.settings().set({ brain: { enabled: brainAtivo } });

  const settingsIniciais = store.settings().get();
  voiceEnabled = Boolean(settingsIniciais.voiceEnabled ?? true);
  createWindow();
  registerIpc();
  registerSpeech();
  tts.on('state', (state) => {
    // Enquanto fala, o microfone é silenciado para não captar o próprio alto-falante.
    speech.setMuted(Boolean(state.speaking));
    pushState(state);
  });

  globalShortcut.register('Control+Shift+J', () => toggleListening());
  globalShortcut.register('Control+Shift+Q', () => app.quit());

  // Começa ouvindo automaticamente, exceto se o usuário já tiver desligado
  // o microfone por voz — a preferência precisa sobreviver ao reinício.
  toggleListening(!Boolean(settingsIniciais.microphoneMuted), true);
  if (listening) pushState({ caption: WAKE_HINT });
});

app.on('window-all-closed', () => {
  speech.stop();
  tts.stop();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  speech.stop();
  tts.stop();
});
