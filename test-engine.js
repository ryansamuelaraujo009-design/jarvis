'use strict';

const assert = require('assert');
const engine = require('./lib/engine');
const brain = require('./lib/brain');

brain.clearMemory();
brain.ingestTraining(require('./lib/training-data'));
brain.setProfile({ userName: 'Ryan' });

const cases = [
  ['oi', (r) => r.reply.toLowerCase().includes('ryan')],
  ['quanto é 15% de 240', (r) => r.reply.includes('36')],
  ['calcule 12 * 8', (r) => r.reply.includes('96')],
  ['que horas são', (r) => /Agora são/.test(r.reply)],
  ['abrir bloco de notas', (r) => r.action?.type === 'openApp' && r.action.payload.exe === 'notepad.exe'],
  ['abrir o site google', (r) => r.action?.type === 'openUrl' && /google/.test(r.action.payload.url)],
  ['quero abrir o youtube', (r) => r.action?.type === 'openUrl' && /youtube/.test(r.action.payload.url)],
  ['abrir github', (r) => r.action?.type === 'openUrl' && /github/.test(r.action.payload.url)],
  ['abrir arquivo relatorio', (r) => r.action?.type === 'openFile'],
  ['pesquisar css grid', (r) => r.action?.type === 'openUrl' && /google/.test(r.action.payload.url)],
  ['digite olá mundo', (r) => r.action?.type === 'typeText'],
  ['tire um print', (r) => r.action?.type === 'screenshot'],
  ['aperte ctrl c', (r) => r.action?.type === 'hotkey' && r.action.payload.keys === '^c'],
  ['anote comprar cafe', (r) => r.write?.store === 'notes'],
  ['criar tarefa estudar CSS', (r) => r.write?.store === 'tasks'],
  ['crie uma tarefa estudar SEO', (r) => r.write?.store === 'tasks' && /seo/i.test(r.write.item.text)],
  ['listar tarefas', (r) => r.data?.type === 'tasksList'],
  ['explicar javascript', (r) => r.reply.includes('JavaScript') && !r.webSearch],
  ['como vender sites', (r) => r.reply.includes('três planos')],
  ['bloquear o pc', (r) => r.action?.type === 'lockWorkstation'],
  ['desligar microfone', (r) => r.setting?.microphoneMuted === true],
  ['ativar microfone', (r) => r.setting?.microphoneMuted === false],
  ['coisa aleatoria sem sentido', (r) => Boolean(r.webSearch?.query) && !r.action],
  ['por que o ceu e azul', (r) => Boolean(r.webSearch?.query) && !r.action],
  ['pode abrir o bloco de notas', (r) => r.action?.type === 'openApp' && r.action.payload.exe === 'notepad.exe'],
  ['me abra o chrome', (r) => r.action?.type === 'openApp' && /chrome/.test(r.action.payload.exe)],
  ['abre bloco de nota', (r) => r.action?.type === 'openApp' && r.action.payload.exe === 'notepad.exe'],
  ['abrir google drive', (r) => r.action?.type === 'openUrl' && /drive.google/.test(r.action.payload.url)],
  ['tira um print', (r) => r.action?.type === 'screenshot'],
  ['quanto e quinze mais vinte e cinco', (r) => r.reply.includes('40')],
  ['quanto e o dobro de doze', (r) => r.reply.includes('24')],
  ['como funciona o flexbox', (r) => r.reply.includes('Flexbox') && !r.webSearch],
  ['para que serve o git', (r) => r.reply.includes('Git') && !r.webSearch],
  ['explique css', (r) => r.reply.includes('CSS') && !r.webSearch],
  ['me explique grid', (r) => r.reply.includes('Grid') && !r.webSearch]
];

let failures = 0;
for (const [input, check] of cases) {
  try {
    const result = engine.parse(input);
    assert.ok(check(result), JSON.stringify(result));
    console.log(`ok  ${input}`);
  } catch (error) {
    failures += 1;
    console.error(`FALHOU: ${input}`);
    console.error(`  ${error.message}`);
  }
}

assert.strictEqual(failures, 0, `${failures} teste(s) falharam`);
console.log(`\n${cases.length} testes do interpretador concluídos com sucesso.`);
