'use strict';

/** Execução das ações no Windows. */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ps = (value) => `'${String(value).replace(/'/g, "''")}'`;

function run(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, (error, stdout) => {
      if (error) reject(error); else resolve(String(stdout || '').trim());
    });
  });
}

function findFile(name) {
  const query = String(name || '').toLowerCase();
  const roots = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'OneDrive', 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'OneDrive', 'Documentos'),
    path.join(os.homedir(), 'Downloads')
  ];
  const walk = (dir, depth) => {
    if (depth > 4 || !fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().includes(query)) return path.join(dir, entry.name);
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const found = walk(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  for (const root of roots) {
    const found = walk(root, 0);
    if (found) return found;
  }
  return null;
}

async function execute(action) {
  const payload = action?.payload || {};
  switch (action?.type) {
    case 'openApp': {
      const exe = String(payload.exe || '');
      if (!/^[a-zA-Z0-9._-]+\.(exe|cmd)$/.test(exe)) throw new Error('Executável inválido.');
      const args = String(payload.args || '');
      await run(`Start-Process -FilePath ${ps(exe)} -ArgumentList ${ps(args)} -ErrorAction SilentlyContinue`);
      return `${exe} iniciado.`;
    }
    case 'openUrl': {
      const url = String(payload.url || '');
      if (!/^https?:\/\//i.test(url)) throw new Error('URL inválida.');
      await run(`Start-Process ${ps(url)}`);
      return 'Site aberto.';
    }
    case 'openFile': {
      const found = findFile(payload.name);
      if (!found) return `Não encontrei ${payload.name}.`;
      await run(`Invoke-Item -LiteralPath ${ps(found)}`);
      return `Arquivo aberto: ${found}`;
    }
    case 'typeText': {
      // SendKeys trata + ^ % ~ ( ) { } [ ] como modificadores. Sem escapar,
      // "digite 100%" aperta ALT e "a+b" vira "aB".
      const seguro = String(payload.text || '').replace(/[+^%~(){}\[\]]/g, (char) => `{${char}}`);
      await run(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(${ps(seguro)})`);
      return 'Texto digitado.';
    }
    case 'hotkey':
      await run(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(${ps(String(payload.keys || ''))})`);
      return 'Atalho executado.';
    case 'screenshot': {
      const dir = path.join(os.homedir(), 'Pictures', 'Jarvis');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `print-${Date.now()}.png`);
      await run([
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        '$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
        '$img = New-Object System.Drawing.Bitmap($b.Width, $b.Height)',
        '$g = [System.Drawing.Graphics]::FromImage($img)',
        '$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)',
        `$img.Save(${ps(file)}, [System.Drawing.Imaging.ImageFormat]::Png)`,
        '$g.Dispose(); $img.Dispose()'
      ].join('; '));
      return `Captura salva em ${file}`;
    }
    case 'saveFile': {
      const dir = path.join(os.homedir(), 'Documents', 'Jarvis', 'Propostas');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, String(payload.filename || `arquivo-${Date.now()}.txt`).replace(/[<>:"|?*]/g, '_'));
      fs.writeFileSync(file, String(payload.content || ''), 'utf8');
      return `Arquivo salvo: ${file}`;
    }
    case 'lockWorkstation':
      await run('rundll32.exe user32.dll,LockWorkStation');
      return 'Windows bloqueado.';
    case 'minimize':
      await run('$s = New-Object -ComObject Shell.Application; $s.MinimizeAll()');
      return 'Janelas minimizadas.';
    default:
      throw new Error(`Ação desconhecida: ${action?.type}`);
  }
}

module.exports = { execute };
