'use strict';

const assert = require('assert');
const brain = require('./lib/brain');
const engine = require('./lib/engine');
const training = require('./lib/training-data');

brain.clearMemory();

const cases = [
  ['normaliza e tokeniza', () => {
    assert.strictEqual(brain.norm('Olá, como vai?'), 'ola como vai');
    assert.deepStrictEqual(brain.tokens('Os gatos correm muito'), ['gato', 'correm']);
    assert.deepStrictEqual(brain.tokens('aperte ctrl c'), ['aperte', 'ctrl', 'c']);
  }],

  ['guarda fatos sobre o usuário', () => {
    brain.handleDirect('meu nome é Ryan');
    assert.ok(brain.handleDirect('o que você sabe sobre mim').reply.includes('Ryan'));
  }],

  ['aprende atalho por comando explícito', () => {
    brain.handleDirect('quando eu disser blz, abra o bloco de notas');
    const parsed = engine.parse('blz');
    assert.strictEqual(parsed.action?.type, 'openApp');
    assert.strictEqual(parsed.brain?.source, 'aprendido');
  }],

  ['aprende com correção', () => {
    brain.recordInteraction('abre o bloco de notas', 'Abrindo bloco de notas.');
    const answer = brain.handleDirect('quis dizer abrir calculadora');
    assert.ok(answer.reply.includes('Corrigido'), answer.reply);
  }],

  ['treino em lote é idempotente', () => {
    const first = brain.ingestTraining(training);
    const second = brain.ingestTraining(training);
    assert.ok(first.examples > 0);
    assert.ok(first.facts > 0);
    assert.strictEqual(second.examples, 0);
    assert.strictEqual(second.facts, 0);
  }],

  ['resposta treinada vale mais que regra fixa', () => {
    brain.teach('qual é a capital do brasil', 'A capital do Brasil é Brasília.', 'trained');
    const parsed = engine.parse('qual é a capital do brasil');
    assert.ok(parsed.reply.includes('Brasília'), JSON.stringify(parsed));
    assert.strictEqual(parsed.webSearch, undefined);
  }],

  ['aprende da web e responde local depois', () => {
    const results = [{ title: 'Capital da Austrália', snippet: 'A capital da Austrália é Canberra.', domain: 'exemplo.com' }];
    assert.strictEqual(brain.learnWeb('qual e a capital da australia', results), 1);
    const again = engine.parse('qual e a capital da australia');
    assert.strictEqual(again.brain?.source, 'web');
    assert.strictEqual(again.webSearch, undefined);
    assert.ok(again.reply.includes('Canberra'));
    assert.strictEqual(brain.learnWeb('qual e a capital da australia', results), 0);
  }],

  ['pergunta desconhecida pede web sem ação', () => {
    const parsed = engine.parse('por que o ceu e azul');
    assert.ok(parsed.webSearch?.query);
    assert.strictEqual(parsed.action, undefined);
  }],

  ['esqueça remove memória', () => {
    brain.handleDirect('lembre que cor favorita é azul');
    assert.ok(brain.handleDirect('esqueça cor favorita').reply.includes('Esquecido'));
  }],

  ['limpar memória zera tudo', () => {
    assert.ok(brain.clearMemory().removed > 0);
    assert.strictEqual(brain.status().webLearned, 0);
    assert.strictEqual(brain.status().facts, 0);
  }]
];

let failures = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FALHOU: ${name}`);
    console.error(`  ${error.message}`);
  }
}

assert.strictEqual(failures, 0, `${failures} teste(s) falharam`);
console.log(`\n${cases.length} testes do cérebro concluídos com sucesso.`);
