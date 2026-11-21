'use strict';

const assert = require('assert');
const web = require('./lib/websearch');

const html = `
<table>
  <tr><td class="result-link"><a href="#" class="result-link">Por que o céu é azul?</a></td></tr>
  <tr><td class="result-snippet">A luz azul é espalhada mais facilmente pelas moléculas do ar.</td></tr>
</table>
`;

const results = web.parseResults(html, 5);
assert.strictEqual(results.length, 1);
assert.strictEqual(results[0].title, 'Por que o céu é azul?');
assert.ok(results[0].snippet.includes('espalhada'));

const spoken = web.speakable(results, 'por que o ceu e azul', 1);
assert.ok(spoken.includes('Encontrei isto'));
assert.ok(spoken.includes('Guardei isso'));

console.log('1 teste de busca concluído com sucesso.');
