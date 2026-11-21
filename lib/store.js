'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let baseDir = null;
function dataDir() {
  if (!baseDir) {
    // Caminho fixo: a memória e o modelo Vosk ficam sempre em jarvis-assistente,
    // mesmo que o nome do pacote mude.
    baseDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'jarvis-assistente'
    );
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

class JsonStore {
  constructor(name, defaults) {
    this.file = path.join(dataDir(), name);
    this.defaults = structuredClone(defaults);
    this.data = this.#load();
  }

  #load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return { ...structuredClone(this.defaults), ...saved };
    } catch {
      return structuredClone(this.defaults);
    }
  }

  get(key) {
    return key === undefined ? structuredClone(this.data) : structuredClone(this.data[key]);
  }

  set(patch) {
    this.data = { ...this.data, ...(patch || {}) };
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    return this.data;
  }
}

const DEFAULT_SETTINGS = {
  allowActions: true,
  requireConfirmation: false,
  trustedActions: ['openApp', 'openUrl', 'openFile', 'search', 'screenshot', 'typeText', 'hotkey', 'saveFile'],
  voiceEnabled: true,
  wakeWord: ['o papai chegou', 'acorda criança'],
  hotkey: 'Control+Shift+J',
  brain: { enabled: true }
};

module.exports = {
  dataDir,
  settings: () => new JsonStore('settings.json', DEFAULT_SETTINGS),
  notes: () => new JsonStore('notes.json', { items: [] }),
  tasks: () => new JsonStore('tasks.json', { items: [] }),
  brainMemory: () => new JsonStore('brain.json', {})
};
