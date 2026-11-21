'use strict';

/** Frases de ativação e suas variantes toleradas pelo reconhecedor. */

const WAKE_PATTERN = /\b(?:o?\s*papai chegou|o papai chego|acorda a?\s*crianca|acorda crianca)\b/;
const WAKE_HINT = "Diga 'o papai chegou' ou 'acorda criança'";

module.exports = { WAKE_PATTERN, WAKE_HINT };
