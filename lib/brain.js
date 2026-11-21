'use strict';

/**
 * CÉREBRO LOCAL — memória, TF-IDF + cosseno, Markov e aprendizado da web.
 * Nenhuma API, chave ou modelo externo.
 */

const DEFAULT_PROFILE = {
  enabled: true,
  assistantName: 'J.A.R.V.I.S.',
  userName: 'Ryan',
  style: 'tecnico',
  verbosity: 'medio',
  catchphrase: 'À sua disposição.'
};

const defaultState = () => ({
  version: 1,
  profile: { ...DEFAULT_PROFILE },
  facts: [], examples: [], episodes: [], sentences: [], webKnowledge: [],
  corpus: {},
  stats: { interactions: 0, learned: 0, corrections: 0, memoryHits: 0, webLearned: 0 }
});

const LIMITS = { facts: 200, examples: 300, episodes: 40, sentences: 1200, webKnowledge: 1200, corpus: 6000 };

const STOP_WORDS = new Set(`
a as o os um uma uns umas e em no na nos nas de da do das dos ao aos
que com para por sem sob sobre ate entre apos antes durante contra desde
se sim nao ja ainda so mais menos muito bem foi sao era eram sejam seja
eu mim me meu minha meus minhas voce vc seu sua seus suas ele ela eles elas
isso esta este esse essa esses estas aquilo aqui ai la ali onde quando como
qual quais quem porque pois logo entao mas ou nem
`.trim().split(/\s+/));

const norm = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/["'“”‘’`]/g, ' ')
  .replace(/[,.;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();

const normCase = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/["'“”‘’`]/g, ' ').replace(/\s+/g, ' ').trim();

const clean = (value) => String(value || '')
  .replace(/^[\s"'“”‘’`]+/, '')
  .replace(/[\s"'“”‘’`.,!?;:]+$/, '').trim();

const capitalize = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function stem(word) {
  if (word.length < 4) return word;
  return word
    .replace(/(?:coes)$/, 'cao').replace(/(?:oes)$/, 'ao')
    .replace(/(?:aes)$/, 'ao').replace(/(?:ais)$/, 'al')
    .replace(/(?:am)$/, 'a').replace(/(?:es)$/, '').replace(/s$/, '');
}

function tokens(text) {
  const value = norm(text);
  const single = /\b(?:ctrl|alt|shift|win)\b/.test(value);
  return value.split(/\s+/).map(stem).filter((word) =>
    !STOP_WORDS.has(word) && (word.length > 1 || (single && /^[a-z]$/.test(word))));
}

function features(text) {
  const words = tokens(text);
  const vector = new Map();
  words.forEach((word) => vector.set(word, (vector.get(word) || 0) + 1));
  for (let i = 0; i < words.length - 1; i += 1) {
    const key = `${words[i]}_${words[i + 1]}`;
    vector.set(key, (vector.get(key) || 0) + 1);
  }
  return vector;
}

let state = defaultState();
let persistence = null;

function idfTable() {
  const total = Math.max(1, state.examples.length);
  const df = new Map();
  state.examples.forEach((example) => {
    features(example.phrase).forEach((_tf, key) => df.set(key, (df.get(key) || 0) + 1));
  });
  const idf = new Map();
  df.forEach((count, key) => idf.set(key, Math.log(1 + total / (1 + count))));
  return idf;
}

function cosine(a, b, idf) {
  if (!a.size || !b.size) return 0;
  const fallback = Math.log(1 + Math.max(1, state.examples.length) / 2);
  let dot = 0; let na = 0; let nb = 0;
  a.forEach((tf, key) => {
    const weight = idf.get(key) ?? fallback;
    na += (tf * weight) ** 2;
    if (b.has(key)) dot += tf * b.get(key) * weight * weight;
  });
  b.forEach((tf, key) => {
    const weight = idf.get(key) ?? fallback;
    nb += (tf * weight) ** 2;
  });
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function save() {
  if (!persistence) return;
  try { persistence.save(state); } catch (error) { console.warn('Falha ao salvar cérebro:', error.message); }
}

function attachPersistence(provider) {
  persistence = provider || null;
  const loaded = persistence?.load?.();
  if (!loaded || typeof loaded !== 'object') return;
  const base = defaultState();
  state = {
    ...base, ...loaded,
    profile: { ...base.profile, ...(loaded.profile || {}) },
    stats: { ...base.stats, ...(loaded.stats || {}) },
    facts: Array.isArray(loaded.facts) ? loaded.facts : [],
    examples: Array.isArray(loaded.examples) ? loaded.examples : [],
    episodes: Array.isArray(loaded.episodes) ? loaded.episodes : [],
    sentences: Array.isArray(loaded.sentences) ? loaded.sentences : [],
    webKnowledge: Array.isArray(loaded.webKnowledge) ? loaded.webKnowledge : [],
    corpus: loaded.corpus && typeof loaded.corpus === 'object' ? loaded.corpus : {}
  };
}

const getState = () => structuredClone(state);
const isEnabled = () => state.profile.enabled !== false;

function setEnabled(value) { state.profile.enabled = Boolean(value); save(); return state.profile.enabled; }
function setProfile(patch) { state.profile = { ...state.profile, ...(patch || {}) }; save(); return { ...state.profile }; }

function status() {
  return {
    enabled: isEnabled(),
    interactions: state.stats.interactions,
    learned: state.examples.filter((e) => e.source === 'user').length,
    trained: state.examples.filter((e) => e.source === 'trained').length,
    corrections: state.stats.corrections,
    webLearned: state.webKnowledge.length,
    facts: state.facts.length,
    examples: state.examples.length,
    episodes: state.episodes.length,
    sentences: state.sentences.length,
    profile: { ...state.profile }
  };
}

function addFact(predicate, value) {
  const text = clean(value);
  if (!predicate || !text) return null;
  const found = state.facts.find((fact) => fact.predicate === predicate && norm(fact.value) === norm(text));
  if (found) { found.value = text; found.at = new Date().toISOString(); }
  else {
    state.facts.unshift({ id: uid(), predicate, value: text.slice(0, 180), at: new Date().toISOString(), hits: 0 });
    state.facts = state.facts.slice(0, LIMITS.facts);
  }
  save();
  return text;
}

function teach(phrase, canonical, source = 'user') {
  const from = clean(phrase);
  const to = clean(canonical);
  if (!from || !to) throw new Error('Frase e comando são obrigatórios.');
  const found = state.examples.find((example) => norm(example.phrase) === norm(from));
  if (found) {
    found.canonical = to; found.source = source; found.at = new Date().toISOString();
  } else {
    state.examples.unshift({
      id: uid(), phrase: from.slice(0, 140), canonical: to.slice(0, 180),
      source, hits: 0, at: new Date().toISOString()
    });
    state.examples = state.examples.slice(0, LIMITS.examples);
  }
  if (source === 'user') state.stats.learned += 1;
  save();
  return { phrase: from, canonical: to };
}

function matchLearned(raw, options = {}) {
  const query = features(raw);
  if (!query.size) return null;
  const idf = idfTable();
  const exact = norm(raw);
  let best = null;
  state.examples.forEach((example) => {
    if (options.onlyUser && example.source !== 'user') return;
    if (options.onlyTrained && example.source !== 'trained') return;
    if (options.onlyBuiltin && example.source !== 'builtin') return;
    let score = cosine(query, features(example.phrase), idf);
    const phrase = norm(example.phrase);
    if (phrase === exact) score = 1;
    else if (phrase.includes(exact) || exact.includes(phrase)) score = Math.min(1, score + 0.22);
    if (!best || score > best.score) best = { example, score };
  });
  if (!best) return null;
  const threshold = best.example.source === 'user' ? 0.48
    : best.example.source === 'trained' ? 0.58 : 0.62;
  if (best.score < threshold) return null;
  if (tokens(raw).length === 1 && tokens(best.example.phrase).length > 2 && best.score < 0.8) return null;
  best.example.hits += 1;
  save();
  return {
    canonical: best.example.canonical,
    meta: {
      source: best.example.source === 'user' ? 'aprendido'
        : best.example.source === 'trained' ? 'treinado' : 'atalho',
      confidence: Number(best.score.toFixed(2)),
      phrase: best.example.phrase
    }
  };
}

/* Aprendizado a partir das buscas */
function learnWeb(question, results) {
  const asked = clean(question);
  if (!asked || !Array.isArray(results) || !results.length) return 0;
  let added = 0;
  results.forEach((item) => {
    const answer = clean(item?.snippet || item?.answer || item?.title);
    if (!answer) return;
    if (state.webKnowledge.some((e) => norm(e.question) === norm(asked) && norm(e.answer) === norm(answer))) return;
    state.webKnowledge.unshift({
      id: uid(), question: asked.slice(0, 200), answer: answer.slice(0, 500),
      title: clean(item?.title || '').slice(0, 140),
      domain: clean(item?.domain || item?.link || '').slice(0, 100),
      hits: 0, at: new Date().toISOString()
    });
    added += 1;
    state.sentences.unshift(answer.slice(0, 240));
    tokens(answer).forEach((word) => { state.corpus[word] = Math.min(999, (state.corpus[word] || 0) + 1); });
  });
  state.webKnowledge = state.webKnowledge.slice(0, LIMITS.webKnowledge);
  state.sentences = state.sentences.slice(0, LIMITS.sentences);
  const keys = Object.keys(state.corpus);
  if (keys.length > LIMITS.corpus) keys.slice(0, keys.length - LIMITS.corpus).forEach((key) => delete state.corpus[key]);
  if (added) state.stats.webLearned += added;
  save();
  return added;
}

function findWebAnswer(raw) {
  if (!state.webKnowledge.length) return null;
  const query = features(raw);
  const exact = norm(raw);
  const df = new Map();
  state.webKnowledge.forEach((entry) => {
    features(`${entry.question} ${entry.answer}`).forEach((_tf, key) => df.set(key, (df.get(key) || 0) + 1));
  });
  const idf = new Map();
  const total = state.webKnowledge.length;
  df.forEach((count, key) => idf.set(key, Math.log(1 + total / (1 + count))));
  let best = null;
  state.webKnowledge.forEach((entry) => {
    const score = cosine(query, features(`${entry.question} ${entry.answer}`), idf);
    const final = norm(entry.question) === exact ? 1 : score;
    if (!best || final > best.score) best = { entry, score: final };
  });
  return best;
}

/* Gerador Markov local */
function hash(seed) {
  let value = 2166136261;
  for (const char of String(seed)) { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); }
  return value >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildChain(sentences) {
  const chain = new Map();
  sentences.forEach((sentence) => {
    const words = tokens(sentence);
    if (words.length < 3) return;
    for (let i = 0; i < words.length - 2; i += 1) {
      const key = `${words[i]}|${words[i + 1]}`;
      if (!chain.has(key)) chain.set(key, []);
      chain.get(key).push(words[i + 2]);
    }
  });
  return chain;
}

function generateText(seedText) {
  const sentences = [
    ...state.facts.map((f) => `${f.predicate} ${f.value}`),
    ...state.examples.map((e) => e.canonical),
    ...state.episodes.flatMap((e) => [e.input, e.reply]),
    ...state.webKnowledge.map((item) => item.answer),
    ...state.sentences
  ];
  const chain = buildChain(sentences);
  if (!chain.size) return '';
  const starts = [...chain.keys()];
  const random = mulberry32(hash(`${seedText}|${Date.now()}`));
  let key = starts[Math.floor(random() * starts.length)];
  const words = key.split('|');
  for (let i = 0; i < 18; i += 1) {
    const options = chain.get(key);
    if (!options?.length) break;
    const next = options[Math.floor(random() * options.length)];
    words.push(next);
    key = `${words[words.length - 2]}|${next}`;
  }
  return capitalize(words.join(' '));
}

const OPENERS = {
  tecnico: ['Entendido', 'Registrado', 'Pronto'],
  informal: ['Beleza', 'Anotado', 'Fechado'],
  formal: ['Com certeza', 'Perfeitamente', 'Devidamente registrado'],
  motivacional: ['Vamos nessa', 'Boa iniciativa', 'Isso mesmo']
};

function pick(list, seed) { return list.length ? list[hash(seed) % list.length] : ''; }

function byVerbosity(lines) {
  if (state.profile.verbosity === 'curto') return lines[0];
  if (state.profile.verbosity === 'detalhado') return lines[lines.length - 1];
  return lines[Math.min(1, lines.length - 1)];
}

function greet() {
  const hour = new Date().getHours();
  const time = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const name = state.profile.userName ? `, ${state.profile.userName}` : '';
  return `${time}${name}. ${state.profile.catchphrase}`;
}

function howAreYou() { return 'Estou operando dentro dos parâmetros ideais. E você, como está?'; }

function brainIntro() {
  return [
    'Sou um cérebro local feito só em código, sem API e sem chave.',
    `Tenho ${state.facts.length} fatos, ${state.webKnowledge.length} respostas da web e ${state.stats.interactions} conversas.`,
    'Guardo o que você me ensina e aprendo com o que busco na web.'
  ].join(' ');
}
const selfIntro = brainIntro;

function result(reply, source, extra = {}) {
  return { intent: 'brain', reply, brain: { source, confidence: 1 }, ...extra };
}

function recallReply(facts, raw = '') {
  if (!facts.length) return 'Ainda não guardei isso sobre você. Pode me dizer, por exemplo: meu nome é Ryan.';
  const list = facts.slice(0, 6).map((fact) => `${fact.predicate}: ${fact.value}`).join('. ');
  return `${pick(OPENERS[state.profile.style] || OPENERS.tecnico, raw)}. Segundo minha memória: ${list}.`;
}

function forget(query) {
  const text = clean(query);
  if (!text) return { reply: 'O que devo esquecer?', removed: 0 };
  const q = norm(text);
  const all = /^(tudo|memoria|memoria toda|tudo que voce sabe)$/.test(q);
  let removed = 0;
  if (all) {
    removed = state.facts.length + state.examples.length + state.webKnowledge.length + state.sentences.length;
    state.facts = []; state.examples = []; state.episodes = []; state.webKnowledge = [];
    state.sentences = []; state.corpus = {};
  } else if (q.length < 3) {
    // "esqueça a", "esqueça de" etc. casariam com quase tudo por substring.
    return { reply: 'Diga um termo maior para eu esquecer (pelo menos 3 letras).', removed: 0 };
  } else {
    const matches = (value) => norm(value).includes(q) || q.includes(norm(value));
    const before = state.facts.length + state.examples.length + state.webKnowledge.length;
    state.facts = state.facts.filter((f) => !matches(`${f.predicate} ${f.value}`));
    state.examples = state.examples.filter((e) => !matches(`${e.phrase} ${e.canonical}`));
    state.webKnowledge = state.webKnowledge.filter((e) => !matches(`${e.question} ${e.answer}`));
    removed = before - (state.facts.length + state.examples.length + state.webKnowledge.length);
  }
  save();
  return { reply: `Esquecido: ${removed} item(ns) removido(s).`, removed };
}

function clearMemory() {
  const removed = state.facts.length + state.examples.length + state.episodes.length
    + state.sentences.length + state.webKnowledge.length;
  state.facts = []; state.examples = []; state.episodes = []; state.sentences = [];
  state.webKnowledge = []; state.corpus = {};
  state.stats = { interactions: 0, learned: 0, corrections: 0, memoryHits: 0, webLearned: 0 };
  save();
  return { reply: `Memória zerada. ${removed} itens removidos.`, removed };
}

function handleDirect(raw) {
  const text = normCase(raw);

  if (/^(desativar|desligar|parar) (o )?(cerebro|memoria)/.test(text)) {
    setEnabled(false);
    return result('Cérebro local desativado.', 'perfil');
  }
  if (/^(ativar|ligar) (o )?(cerebro|memoria)/.test(text)) {
    setEnabled(true);
    return result('Cérebro local ativado.', 'perfil');
  }

  let match = text.match(/^(seu nome e|chame-se|mude seu nome para|se chama)\s+(.+)$/);
  if (match) {
    const name = clean(match[2]).slice(0, 40);
    setProfile({ assistantName: name });
    return result(`Pronto. Agora me chamo ${name}.`, 'perfil');
  }

  match = text.match(/^(seja mais|fale de forma|responda de forma|use um tom)\s+(.+)$/);
  if (match) {
    const value = clean(match[2]);
    const patch = {};
    if (/curto|objetiv|resumid|breve/.test(value)) patch.verbosity = 'curto';
    else if (/detalhad|completo|explicad|longo/.test(value)) patch.verbosity = 'detalhado';
    else if (/informal|descontraid|amigavel/.test(value)) patch.style = 'informal';
    else if (/formal|profission/.test(value)) patch.style = 'formal';
    else if (/motiv|animad|energ/.test(value)) patch.style = 'motivacional';
    else patch.style = 'tecnico';
    setProfile(patch);
    return result('Personalidade ajustada.', 'perfil');
  }

  match = text.match(/^(quando|sempre que)\s+(eu\s+)?(disser|falar|digitar)\s+(.+?)\s*,\s*(entao\s+)?(voce\s+)?(deve\s+|pode\s+|vai\s+|precisa\s+|faca\s+|execute\s+|rode\s+)?(.+)$/);
  if (match) {
    const phrase = clean(match[4]);
    const canonical = clean(match[8]);
    teach(phrase, canonical, 'user');
    return result(`Aprendi: quando você disser ${phrase}, eu vou fazer ${canonical}.`, 'aprendizado');
  }

  match = text.match(/(queria dizer|quis dizer|era isso|nao era|errado|corrija|corrigir)\s*,?\s*(.+)$/);
  if (match && state.episodes.length) {
    const canonical = clean(match[2])
      .replace(/^(eu\s+)?(queria|quis)\s+dizer\s+/i, '')
      .replace(/^(era|devia ser)\s+/i, '');
    const last = state.episodes.find((episode) => norm(episode.input) !== text) || state.episodes[0];
    if (canonical && last) {
      teach(last.input, canonical);
      state.stats.corrections += 1;
      save();
      return result(`Corrigido. Vou entender ${last.input} como ${canonical} da próxima vez.`, 'correcao');
    }
  }

  match = text.match(/^(meu nome e|me chamo|eu sou)\s+(.+)$/);
  if (match) {
    const name = clean(match[2]).slice(0, 40);
    setProfile({ userName: name });
    addFact('nome', name);
    return result(`Guardo isso: seu nome é ${name}.`, 'memoria');
  }

  match = text.match(/^(lembre que|lembre-se que|guarda que|lembrar que)\s+(.+)$/);
  if (match) {
    const value = clean(match[2]);
    const parts = value.split(/\s+e\s+|\s+eh\s+/i);
    if (parts.length >= 2) addFact(clean(parts[0]), clean(parts.slice(1).join(' ')));
    else addFact('lembrete', value);
    return result('Guardei isso na memória.', 'memoria');
  }

  if (/^(o que voce sabe sobre mim|fale sobre mim|quem sou eu|meu resumo)/.test(text)) {
    return result(recallReply(state.facts), 'memoria');
  }

  match = text.match(/^(esqueca|esqueca|apague|remova)\s+(.+)$/);
  if (match) {
    const answer = forget(clean(match[2]));
    return result(answer.reply, 'memoria');
  }

  match = text.match(/^(lembra|lembre|voce lembra)( de| que)?\s+(.+)$/);
  if (match) {
    state.stats.memoryHits += 1;
    save();
    return result(recallReply(state.facts.filter((f) => norm(`${f.predicate} ${f.value}`).includes(norm(match[3]))), raw), 'memoria');
  }

  if (/^(como voce funciona|como funciona sua memoria|como voce aprende|qual e seu cerebro|estatisticas)/.test(text)) {
    return result(brainIntro(), 'perfil');
  }
  if (/^(quem e voce|fale sobre voce|sobre voce)/.test(text)) {
    return result(`${brainIntro()} Meu nome é ${state.profile.assistantName}.`, 'perfil');
  }
  return null;
}

function nearestFact(query) {
  const q = features(query);
  let best = null;
  state.facts.forEach((fact) => {
    const score = cosine(q, features(`${fact.predicate} ${fact.value}`), new Map());
    if (!best || score > best.score) best = { fact, score };
  });
  return best;
}

function respond(raw) {
  if (!isEnabled()) return null;
  const text = norm(raw);

  if (/^(obrigad|valeu|agradec)/.test(text)) {
    return { reply: byVerbosity(['De nada.', `Sempre, ${state.profile.userName}.`, 'Se precisar de algo mais, é só chamar.']), brain: { source: 'personalidade', confidence: 0.8 } };
  }
  if (/^(e voce|e você|como voce esta|como você está)/.test(text)) {
    return { reply: howAreYou(), brain: { source: 'personalidade', confidence: 0.8 } };
  }
  if (/^(improvisar|crie uma frase|conte algo|historia|fale algo aleatorio|invente)/.test(text)) {
    const generated = generateText(text);
    if (generated) return { reply: generated, brain: { source: 'gerador-local', confidence: 0.7 } };
  }

  const webHit = findWebAnswer(raw);
  if (webHit && webHit.score > 0.55) {
    webHit.entry.hits += 1;
    state.stats.memoryHits += 1;
    save();
    return {
      reply: webHit.entry.answer,
      brain: { source: 'web', confidence: Number(webHit.score.toFixed(2)) }
    };
  }

  const fact = nearestFact(text);
  if (fact && fact.score > 0.42) {
    fact.fact.hits += 1;
    state.stats.memoryHits += 1;
    save();
    return { reply: `${capitalize(fact.fact.predicate)}: ${fact.fact.value}.`, brain: { source: 'memoria', confidence: Number(fact.score.toFixed(2)) } };
  }

  return {
    reply: byVerbosity([
      'Ainda não sei responder isso.',
      'Posso aprender se você me ensinar, ou buscar na web agora.',
      'Você pode dizer: lembre que ..., ou simplesmente me faça uma pergunta.'
    ]),
    brain: { source: 'local', confidence: 0.3 },
    unknown: true
  };
}

function ingestTraining(data = {}) {
  const added = { facts: 0, examples: 0, sentences: 0 };
  (Array.isArray(data.facts) ? data.facts : []).forEach((item) => {
    const [predicate, value] = Array.isArray(item) ? item : [item?.predicate, item?.value];
    const text = clean(value);
    if (!predicate || !text) return;
    if (state.facts.some((f) => f.predicate === predicate && norm(f.value) === norm(text))) return;
    addFact(predicate, text);
    added.facts += 1;
  });
  (Array.isArray(data.commands) ? data.commands : []).forEach((item) => {
    const [phrase, canonical] = Array.isArray(item) ? item : [item?.phrase, item?.canonical];
    if (!clean(phrase) || !clean(canonical)) return;
    if (state.examples.some((e) => norm(e.phrase) === norm(phrase))) return;
    teach(phrase, canonical, 'trained');
    added.examples += 1;
  });
  const fresh = [];
  (Array.isArray(data.sentences) ? data.sentences : []).forEach((sentence) => {
    const text = clean(sentence);
    if (!text || state.sentences.some((old) => norm(old) === norm(text))) return;
    state.sentences.unshift(text.slice(0, 240));
    fresh.push(text);
    added.sentences += 1;
  });
  state.sentences = state.sentences.slice(0, LIMITS.sentences);
  fresh.forEach((sentence) => tokens(sentence).forEach((word) => { state.corpus[word] = Math.min(999, (state.corpus[word] || 0) + 1); }));
  const keys = Object.keys(state.corpus);
  if (keys.length > LIMITS.corpus) keys.slice(0, keys.length - LIMITS.corpus).forEach((key) => delete state.corpus[key]);
  save();
  return {
    ...added,
    reply: `Base local treinada: ${added.facts} fatos, ${added.examples} comandos e ${added.sentences} frases novos.`
  };
}

function recordInteraction(input, reply) {
  state.stats.interactions += 1;
  state.episodes.unshift({
    input: String(input || '').slice(0, 300),
    reply: String(reply || '').slice(0, 300),
    at: new Date().toISOString()
  });
  state.episodes = state.episodes.slice(0, LIMITS.episodes);
  tokens(`${input} ${reply}`).forEach((word) => { state.corpus[word] = (state.corpus[word] || 0) + 1; });
  const keys = Object.keys(state.corpus);
  if (keys.length > LIMITS.corpus) keys.slice(0, keys.length - LIMITS.corpus).forEach((key) => delete state.corpus[key]);
  save();
}

const BUILTIN = [
  { phrase: 'me diga as horas', canonical: 'que horas sao' },
  { phrase: 'faz uma piada', canonical: 'piada' },
  { phrase: 'me ajuda', canonical: 'ajuda' }
];
BUILTIN.forEach((item, index) => state.examples.push({
  id: `builtin-${index}`, phrase: item.phrase, canonical: item.canonical,
  source: 'builtin', hits: 0, at: new Date(0).toISOString()
}));

module.exports = {
  defaultState, attachPersistence, getState, isEnabled, setEnabled, setProfile, status,
  greet, howAreYou, selfIntro, brainIntro, handleDirect, matchLearned, respond, teach,
  learnWeb, findWebAnswer, recordInteraction, ingestTraining, forget, clearMemory, norm, tokens
};
