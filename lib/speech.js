'use strict';

/** Reconhecedor Vosk local em Python — transcrição acontece só neste PC. */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');
const { dataDir } = require('./store');
const { normalizeTranscript } = require('./speech-normalize');

class SpeechManager extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.ready = false;
    this.desired = false;
    this.retries = 0;
    this.muted = false;
  }

  get modelPath() {
    return path.join(dataDir(), 'vosk-model-small-pt-0.3');
  }

  start() {
    this.desired = true;
    this.retries = 0;
    return this.#spawn();
  }

  #spawn() {
    if (this.child && !this.child.killed) return true;
    this.ready = false;
    this.child = spawn('python', [path.join(__dirname, 'vosk_listener.py'), this.modelPath], { windowsHide: true });
    this.child.on('error', (error) => console.error('[SPEECH] spawn error', error.message));
    this.emit('status', { running: true, ready: false });

    this.child.stdout.on('data', (chunk) => {
      String(chunk).split(/\r?\n/).forEach((line) => {
        if (!line.trim()) return;
        if (line.startsWith('READY')) {
          this.ready = true;
          this.retries = 0;
          this.sendCommand(this.muted ? 'MUTE' : 'UNMUTE');
          this.emit('ready');
          this.emit('status', { running: true, ready: true });
        } else if (line.startsWith('FINAL ')) {
          try {
            const text = normalizeTranscript(JSON.parse(line.slice(6)).text);
            if (text) this.emit('final', text);
          } catch { /* ignora */ }
        } else if (line.startsWith('PARTIAL ')) {
          try { this.emit('partial', normalizeTranscript(JSON.parse(line.slice(8)).text)); } catch { /* ignora */ }
        } else if (line.startsWith('WEAK ')) {
          try { this.emit('weak', normalizeTranscript(JSON.parse(line.slice(5)).text)); } catch { /* ignora */ }
        }
      });
    });

    this.child.stderr.on('data', (chunk) => {
      const message = String(chunk).trim();
      if (message) this.emit('error', message);
    });

    this.child.on('exit', (code) => {
      this.child = null;
      this.ready = false;
      if (this.desired) console.error('[SPEECH] reconhecedor encerrou', code);
      if (this.desired && this.retries < 10) {
        this.retries += 1;
        const wait = Math.min(5000, 700 * this.retries);
        console.error('[SPEECH] reiniciando', this.retries);
        setTimeout(() => { if (this.desired) this.#spawn(); }, wait);
      } else {
        this.emit('status', { running: false, ready: false });
        if (code !== 0 && code !== null) this.emit('error', `reconhecedor encerrou (${code})`);
      }
    });

    return true;
  }

  stop() {
    this.desired = false;
    if (!this.child) return false;
    this.child.kill();
    this.child = null;
    this.ready = false;
    this.emit('status', { running: false, ready: false });
    return true;
  }

  sendCommand(command) {
    try {
      if (this.child?.stdin?.writable) this.child.stdin.write(`${command}\n`);
    } catch { /* reconhecedor pode estar saindo */ }
  }

  // Silencia a captura enquanto o assistente fala, evitando eco e falsos gatilhos.
  setMuted(value) {
    const next = Boolean(value);
    if (next === this.muted) return;
    this.muted = next;
    this.sendCommand(next ? 'MUTE' : 'UNMUTE');
  }

  status() {
    return { running: Boolean(this.child), ready: this.ready, muted: this.muted, model: this.modelPath };
  }
}

module.exports = new SpeechManager();
