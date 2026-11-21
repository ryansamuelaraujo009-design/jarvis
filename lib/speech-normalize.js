'use strict';

/** Ajusta a transcrição do Vosk antes de interpretar. Nada sai deste PC. */

const NUMBERS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500,
  quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
  setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900,
  novecentas: 900, mil: 1000
};

// Confusões frequentes do Vosk pequeno em pt-BR em palavras de comando.
const CORRECTIONS = [
  [/\bbloco de nota\b/g, 'bloco de notas'],
  [/\btira um print\b/g, 'tire um print'],
  [/\btira uma captura\b/g, 'tire uma captura'],
  [/\babre\b/g, 'abrir'], [/\babri\b/g, 'abrir'],
  [/\banota\b/g, 'anote'], [/\bcria\b/g, 'criar'],
  [/\blista tarefas\b/g, 'listar tarefas'],
  [/\bque horas sao\b/g, 'que horas sao']
];

function readNumber(tokens, start) {
  let i = start;
  let group = 0;
  let thousands = 0;
  let seen = false;
  let connector = false;

  while (i < tokens.length) {
    const token = tokens[i].replace(/[,;.!?]+$/, '');
    if (token === 'e' || token === 'plus') {
      if (!seen || connector) break;
      connector = true;
      i += 1;
      continue;
    }
    const value = NUMBERS[token];
    if (value === undefined) break;

    if (value === 1000) {
      thousands += group || 1;
      group = 0;
    } else {
      group += value;
    }
    seen = true;
    connector = false;
    i += 1;
  }

  if (!seen) return null;
  if (connector) i -= 1; // não consume um "e" solto no fim da sequência
  if (group >= 1000) {
    thousands += Math.floor(group / 1000);
    group %= 1000;
  }
  return { value: thousands * 1000 + group, end: i };
}

function normalizeTranscript(raw) {
  let text = String(raw || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\bpor\s+cento\b/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
  CORRECTIONS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  if (!text) return '';

  const tokens = text.split(' ');
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const number = readNumber(tokens, i);
    if (number && number.end > i) {
      out.push(String(number.value));
      i = number.end;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }

  return out.join(' ')
    .replace(/\b1 print\b/g, 'um print')
    .replace(/\b1 captura\b/g, 'uma captura')
    .replace(/\s+([%.,!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalizeTranscript };
