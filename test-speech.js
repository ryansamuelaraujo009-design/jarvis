'use strict';

const assert = require('assert');
const { normalizeTranscript } = require('./lib/speech-normalize');
const { WAKE_PATTERN } = require('./lib/wake');
const { parse } = require('./lib/engine');

const cases = [
  ['quinze por cento de duzentos e quarenta', '15% de 240'],
  ['quanto e trinta e dois', 'quanto e 32'],
  ['acorda crianca, explique css', 'acorda crianca, explique css'],
  ['crie uma tarefa estudar seo', 'crie 1 tarefa estudar seo'],
  ['dois mil e vinte', '2020'],
  ['mil e quinhentos', '1500'],
  ['cem', '100'],
  ['a ordinária não era comum', 'a ordinaria nao era comum'],
  ['abre bloco de nota', 'abrir bloco de notas'],
  ['tira um print', 'tire um print'],
  ['anota comprar cafe', 'anote comprar cafe']
];

for (const [input, expected] of cases) {
  assert.strictEqual(normalizeTranscript(input), expected, `falhou: ${input}`);
}

const interpreted = parse(normalizeTranscript('quanto e quinze por cento de duzentos e quarenta'));
assert.ok(interpreted.reply.includes('36'), interpreted.reply);

const wakePhrases = [
  'o papai chegou', 'opapai chegou', 'o papai chego', 'papai chegou',
  'acorda crianca', 'acorda a crianca'
];
for (const phrase of wakePhrases) {
  assert.ok(WAKE_PATTERN.test(phrase), `ativação falhou: ${phrase}`);
}
assert.ok(!WAKE_PATTERN.test('o papai saiu'));

console.log(`${cases.length + 2} testes de normalização e ativação de voz concluídos com sucesso.`);
