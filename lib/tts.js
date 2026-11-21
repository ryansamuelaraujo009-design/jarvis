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
    this.ignoreNextExit = false;
  }

  get speaking() { return Boolean(this.current || this.queue.length); }

  #ensureWorker() {
    if (this.worker && !this.worker.killed) return;
    this.workerReady = false;
    const worker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WORKER_SCRIPT], { windowsHide: true });
    this.worker = worker;

    // A referência local é essencial: se stop() matar este worker e speak()
    // criar outro antes do evento 'exit', o evento antigo NÃO pode mexer no
    // worker novo — era isso que gerava dois PowerShell e estado trocado.
    const ownsWorker = () => this.worker === worker;

    let buffer = '';
    worker.stdout.on('data', (chunk) => {
      if (!ownsWorker()) return;
      buffer += String(chunk);
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line === 'READY') {
          this.workerReady = true;
          this.#flush(worker);
        } else if (line === 'DONE') {
          this.#done();
        }
      }
    });
    worker.stderr.on('data', (chunk) => {
      if (!ownsWorker()) return;
      const message = String(chunk).trim();
      if (message) console.error('[TTS]', message);
    });
    worker.on('error', (error) => {
      if (!ownsWorker()) return;
      console.error('[TTS]', error.message);
    });
    worker.on('exit', () => {
      if (!ownsWorker()) return; // worker antigo: já substituído por stop()/restart
      this.worker = null;
      this.workerReady = false;
      if (this.ignoreNextExit) {
        this.ignoreNextExit = false;
        return;
      }
      // Se o processo cair no meio de uma fala, a mensagem atual precisa
      // voltar para a fila — senão this.current fica preso para sempre,
      // o mic continua muteado e o assistente para de responder.
      const pendente = this.current;
      this.current = null;
      if (pendente) this.queue.unshift(pendente);
      if (this.queue.length) this.#ensureWorker();
      else if (!this.speaking) this.emit('state', { speaking: false });
    });
  }

  #flush(worker = this.worker) {
    if (!this.workerReady || !worker || this.current || !this.queue.length) return;
    this.current = this.queue.shift();
    worker.stdin.write(`${Buffer.from(this.current, 'utf8').toString('base64')}\n`);
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
      this.ignoreNextExit = true;
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
