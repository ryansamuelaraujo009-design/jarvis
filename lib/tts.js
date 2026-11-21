'use strict';

/** Fala local com voz pt-BR do Windows. Um único processo PowerShell fica aquecido. */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');

const WORKER_SCRIPT = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  'Add-Type -AssemblyName System.Speech',
  '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
  "foreach ($name in @('Microsoft Maria Desktop','Microsoft Aria Desktop','Microsoft Zira Desktop')) {",
  '  try { $s.SelectVoice($name); break } catch { }',
  '}',
  '$s.Rate = 3',
  '$s.Volume = 100',
  "[Console]::Out.WriteLine('READY')",
  '[Console]::Out.Flush()',
  'while (($line = [Console]::In.ReadLine()) -ne $null) {',
  '  if ($line) {',
  '    try {',
  '      $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line))',
  '      $s.Speak($text)',
  '    } catch { }',
  '  }',
  "  [Console]::Out.WriteLine('DONE')",
  '  [Console]::Out.Flush()',
  '}',
  '$s.Dispose()'
].join('\n');

// O SAPI lê "%" e "&" de forma estranha em pt-BR; escrevemos como se fala.
function forSpeech(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/%/g, ' por cento ')
    .replace(/\s*&\s*/g, ' e ')
    .replace(/\s+([.,!?;])/g, '$1')
    .trim()
    .slice(0, 500);
}

class Speaker extends EventEmitter {
  constructor() {
    super();
    this.worker = null;
    this.workerReady = false;
    this.queue = [];
    this.current = null;
  }

  get speaking() { return Boolean(this.current || this.queue.length); }

  #ensureWorker() {
    if (this.worker && !this.worker.killed) return;
    this.workerReady = false;
    this.worker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WORKER_SCRIPT], { windowsHide: true });

    let buffer = '';
    this.worker.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line === 'READY') {
          this.workerReady = true;
          this.#flush();
        } else if (line === 'DONE') {
          this.#done();
        }
      }
    });
    this.worker.stderr.on('data', (chunk) => {
      const message = String(chunk).trim();
      if (message) console.error('[TTS]', message);
    });
    this.worker.on('exit', () => {
      this.worker = null;
      this.workerReady = false;
      if (this.current || this.queue.length) this.#ensureWorker();
    });
  }

  #flush() {
    if (!this.workerReady || this.current || !this.queue.length) return;
    this.current = this.queue.shift();
    this.worker.stdin.write(`${Buffer.from(this.current, 'utf8').toString('base64')}\n`);
  }

  #done() {
    this.current = null;
    this.#flush();
    if (!this.speaking) this.emit('state', { speaking: false });
  }

  stop() {
    const wasSpeaking = this.speaking;
    this.queue = [];
    this.current = null;
    if (this.worker) {
      this.worker.kill();
      this.worker = null;
      this.workerReady = false;
    }
    if (wasSpeaking) this.emit('state', { speaking: false });
  }

  speak(text) {
    const message = forSpeech(text);
    if (!message) return;
    const wasSpeaking = this.speaking;
    this.queue.push(message);
    this.#ensureWorker();
    this.#flush();
    if (!wasSpeaking) this.emit('state', { speaking: true });
  }
}

module.exports = new Speaker();
