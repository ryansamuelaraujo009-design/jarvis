'use strict';

/** Interpretador local de comandos e perguntas. Respostas curtas, prontas para voz. */

const brain = require('./brain');
const { normalizeTranscript } = require('./speech-normalize');

const norm = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const capitalize = (value) => String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
const timeNow = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
const dateNow = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

function mathWords(input) {
  return String(input || '')
    .replace(/\bmais\b/g, '+')
    .replace(/\bmenos\b/g, '-')
    .replace(/\bvezes\b/g, '*')
    .replace(/\bmultiplicado por\b/g, '*')
    .replace(/\bdividido por\b/g, '/')
    .replace(/\bao quadrado\b/g, '**2')
    .replace(/\bao cubo\b/g, '**3')
    .replace(/\bdobro de\b/g, '2*')
    .replace(/\bmetade de\b/g, '0.5*');
}

function safeCalc(input) {
  let expr = mathWords(String(input || '').replace(/^(?:o|a|os|as)\s+/, ''))
    .replace(/[xX×]/g, '*').replace(/[÷]/g, '/')
    .replace(/\s+de\s+/g, '*').replace(/,/g, '.').replace(/\s+/g, '');
  expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  if (!expr || !/^[0-9+\-*/().]+$/.test(expr)) return null;
  try {
    const value = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  } catch { return null; }
}

const KNOWLEDGE = {
  javascript: 'JavaScript é a linguagem da web. Roda no navegador e, com Node.js, também no servidor. Use const e let no lugar de var, e async e await para código assíncrono.',
  html: 'HTML descreve a estrutura semântica de uma página. Use um único h1, imagens com alt descritivo e marcações como header, main e footer.',
  css: 'CSS controla apresentação e layout. Box sizing border box conta padding e borda na largura. Flexbox atua em uma dimensão e grid em duas.',
  react: 'React monta interfaces com componentes pequenos. O estado dirige a interface, listas precisam de key estável e efeitos sincronizam com sistemas externos.',
  node: 'Node.js roda JavaScript no servidor com event loop não bloqueante. Evite tarefas pesadas nele e use variáveis de ambiente para segredos.',
  python: 'Python tem sintaxe simples e é muito usado em automação e dados. Ambientes virtuais isolam dependências e context managers fecham arquivos corretamente.',
  ingles: 'Para inglês técnico, use frases curtas: Could you clarify? Let me recap the next steps. I work with web development.',
  matematica: 'A derivada mede variação instantânea. Probabilidade é casos favoráveis divididos por casos possíveis. Pratique com problemas variados.',
  seo: 'SEO aumenta visibilidade orgânica com técnica, conteúdo e autoridade. Pesquise a intenção de busca antes de escrever e meça conversões, não só cliques.',
  freelance: 'Para vender sites, descubra o problema de negócio antes de falar preço. Descreva entregas e prazos, ofereça três planos e peça parte no início.',
  flexbox: 'Flexbox distribui itens em uma dimensão. Use display flex, justify content para o eixo principal e align items para o eixo cruzado.',
  grid: 'CSS Grid controla linhas e colunas. Defina grid template columns e use gap para espaçamento entre células.',
  'box model': 'O box model tem conteúdo, padding, borda e margem. Com box sizing border box, a largura inclui padding e borda.',
  git: 'Git registra versões do código. Use commit para salvar um ponto, branch para trabalhar separado e merge para integrar.',
  api: 'API é uma interface entre sistemas. Uma REST API usa URLs e métodos HTTP como GET, POST, PUT e DELETE.',
  banco: 'Banco de dados guarda informação estruturada. Relacionais usam tabelas e SQL; documentais guardam objetos como JSON.',
  negociacao: 'Em negociação, ouça primeiro, entenda o orçamento e mostre o valor entregue. Evite descontos sem reduzir escopo.',
  proposta: 'Uma boa proposta traz escopo, entregas, prazo, preço e condições de pagamento. Deixe claro o que não está incluído.'
};

const TOPIC_ALIASES = {
  'html5': 'html', 'css3': 'css', 'flex box': 'flexbox', 'flex': 'flexbox',
  'css grid': 'grid', 'grid css': 'grid', 'box sizing': 'box model',
  'modelo de caixa': 'box model', 'versionamento': 'git', 'github': 'git',
  'rest': 'api', 'rest api': 'api', 'web api': 'api',
  'banco de dados': 'banco', 'database': 'banco', 'sql': 'banco',
  'vender site': 'freelance', 'vender sites': 'freelance', 'precificar': 'freelance',
  'orcamento': 'proposta', 'fechar negocio': 'negociacao'
};

const APPS = {
  'bloco de notas': 'notepad.exe', notepad: 'notepad.exe',
  calculadora: 'calc.exe', explorer: 'explorer.exe', explorador: 'explorer.exe',
  'meus arquivos': 'explorer.exe', 'google chrome': 'chrome.exe', chrome: 'chrome.exe',
  'microsoft edge': 'msedge.exe', edge: 'msedge.exe', 'navegador padrão': 'msedge.exe',
  'visual studio code': 'code.cmd', 'vs code': 'code.cmd',
  spotify: 'spotify.exe', discord: 'Discord.exe', telegram: 'Telegram.exe',
  word: 'WINWORD.EXE', excel: 'EXCEL.EXE', powershell: 'powershell.exe',
  prompt: 'cmd.exe', cmd: 'cmd.exe', terminal: 'wt.exe',
  'pasta downloads': 'explorer.exe shell:Downloads', 'pasta de downloads': 'explorer.exe shell:Downloads',
  'area de trabalho': 'explorer.exe shell:Desktop', documentos: 'explorer.exe shell:Documents'
};

const SITES = {
  youtube: 'https://www.youtube.com', google: 'https://www.google.com',
  github: 'https://github.com', gmail: 'https://mail.google.com',
  linkedin: 'https://www.linkedin.com', instagram: 'https://www.instagram.com',
  whatsapp: 'https://web.whatsapp.com', netflix: 'https://www.netflix.com',
  figma: 'https://www.figma.com', notion: 'https://www.notion.so',
  chatgpt: 'https://chatgpt.com', 'google drive': 'https://drive.google.com'
};

const HOTKEYS = {
  'ctrl c': '^c', 'ctrl v': '^v', 'ctrl z': '^z', 'ctrl s': '^s', 'ctrl a': '^a',
  'alt tab': '%{TAB}', enter: '{ENTER}', esc: '{ESC}', tab: '{TAB}',
  backspace: '{BACKSPACE}', delete: '{DELETE}', 'win d': '^{ESC}'
};

const JOKES = [
  'Por que o CSS foi ao terapeuta? Porque ele tinha muitos problemas de posicionamento.',
  'Um desenvolvedor nunca se perde: ele dá um git commit e volta.',
  'O JavaScript pediu uma Promise ao barman. O barman disse: vou te responder depois.'
];

const simple = (reply, extra = {}) => ({ intent: 'chat', reply, ...extra });
const action = (reply, type, label, payload = {}) => ({ intent: 'action', reply, action: { type, label, payload } });
const withBrain = (result, meta) => { if (meta && result) result.brain = meta; return result; };

function followLearned(learned, options) {
  const derived = parse(learned.canonical, { ...options, skipLearned: true });
  if (derived.webSearch) return withBrain(simple(learned.canonical), learned.meta);
  return withBrain(derived, learned.meta);
}

function capabilities() {
  return 'Posso abrir aplicativos e sites, fazer contas, dizer horas e data, digitar textos, tirar print, guardar notas e tarefas, explicar assuntos de estudo e criar propostas. Também aprendo com o que você me ensina e com o que busco na web.';
}

function study(rawTopic) {
  const topic = TOPIC_ALIASES[norm(rawTopic)] || norm(rawTopic);
  const text = KNOWLEDGE[topic];
  if (text) return withBrain(simple(text), { source: 'estudo', confidence: 0.9 });
  return simple(`Ainda não tenho uma explicação pronta de ${topic}. Posso buscar na web se quiser.`);
}

function proposal(raw) {
  const match = String(raw || '').match(/(?:para|de)\s+([\p{L}\d]+)(?:\s+de\s+([\p{L}\d-]+))?/iu);
  const client = capitalize(match?.[1] || 'Cliente');
  const type = (match?.[2] || 'landing page').toLowerCase();
  const price = type.includes('ecommerce') ? 'quatro mil e quinhentos reais' : 'mil e oitocentos reais';
  return action(`Proposta para ${client} criada.`, 'saveFile', `Salvar proposta para ${client}`, {
    filename: `Proposta - ${client}.txt`,
    content: `PROPOSTA COMERCIAL\n\nCliente: ${client}\nProjeto: ${type}\nValor: ${price}\nPrazo: 10 dias úteis\n`
  });
}

function cleanQuery(value) {
  return String(value || '').replace(/^(de|sobre|por)\s+/i, '').replace(/[.!?]+$/, '').trim();
}

function parse(rawInput, options = {}) {
  const raw = String(rawInput || '').trim();
  const text = norm(normalizeTranscript(raw));
  if (!text) return simple('Não ouvi nada. Pode repetir?');

  const thought = brain.handleDirect(raw);
  if (thought) return withBrain(thought, thought.brain);

  if (!options.skipLearned) {
    const learned = brain.matchLearned(raw, { onlyUser: true });
    if (learned) return followLearned(learned, options);
  }

  if (/^(oi|ola|salve|bom dia|boa tarde|boa noite|e ai|e aí)/.test(text)) {
    return simple(brain.greet(), { brain: { source: 'personalidade', confidence: 0.8 } });
  }
  if (/^(obrigad|valeu)/.test(text)) return simple('De nada.');
  if (/^(como vai|tudo bem)/.test(text)) return simple(brain.howAreYou());
  if (/^(quem e voce|quem é voce)/.test(text)) return simple(brain.selfIntro());
  if (/(ajuda|comandos|o que pode fazer|o que voce faz|menu)/.test(text)) return simple(capabilities());
  if (/^(piada|faz uma piada|conte uma piada)/.test(text)) {
    return simple(JOKES[Math.floor(Math.random() * JOKES.length)]);
  }
  if (/^(motivacao|me motive|estou desanimado|preciso de forca)/.test(text)) {
    return simple('Constância vence intensidade. Faça um pouco hoje e um pouco amanhã. Você já está construindo algo real.');
  }

  if (/(que horas|hora atual|horas sao|que dia|data de hoje)/.test(text)) {
    return simple(`Agora são ${timeNow()}. Hoje é ${dateNow()}.`);
  }

  const calc = text.match(/^(quanto e|calcule|calcula|resultado de|qual e)\s*(.+)$/);
  const expression = calc ? calc[2]
    : (/^[0-9+\-*/().%x×÷,\s]+$/.test(raw) && /[+\-*/x×÷]/.test(raw) ? raw : null);
  if (expression) {
    const value = safeCalc(expression);
    if (value !== null) return simple(`O resultado é ${new Intl.NumberFormat('pt-BR').format(value)}.`);
    if (/[0-9]/.test(expression) && /[+\-*/x×÷%]/.test(expression)) {
      return simple('Não consegui calcular essa expressão. Tente algo como quanto é quinze por cento de duzentos e quarenta.');
    }
  }

  if (/(ativar|ligar|desligar|desativar|silenciar).*(voz|audio|microfone|mic)|^(mudo)$/.test(text)) {
    const enable = /\b(ativar|ligar)\b/.test(text);
    if (/microfone|mic|mudo/.test(text)) {
      return { intent: 'chat', reply: enable ? 'Microfone ativado.' : 'Microfone desligado.', setting: { microphoneMuted: !enable } };
    }
    return { intent: 'chat', reply: enable ? 'Voz ativada.' : 'Voz desativada.', setting: { voiceEnabled: enable } };
  }
  if (/^(fechar assistente|sair do assistente|fechar jarvis|encerrar)/.test(text)) {
    return { intent: 'system', system: 'quit', reply: 'Encerrando o J.A.R.V.I.S.' };
  }
  if (/^(bloquear o pc|bloquear windows|travar a tela)/.test(text)) {
    return action('Vou bloquear o Windows.', 'lockWorkstation', 'Bloquear o Windows');
  }
  if (/^(mostrar desktop|minimizar tudo)/.test(text)) {
    return action('Vou minimizar as janelas.', 'minimize', 'Mostrar desktop');
  }

  const OPEN_WORDS = /\b(?:abrir|abra|abre|inicie|iniciar|quero usar|vamos|pode)\b/g;
  const wantsOpen = (index) => index >= 0
    && [...text.matchAll(OPEN_WORDS)].some((match) => match.index < index);

  const appCandidates = Object.keys(APPS).sort((a, b) => b.length - a.length);
  const appKey = /\bsite\b/.test(text)
    ? null
    : appCandidates.find((key) => wantsOpen(text.indexOf(key)) && text.includes(key));
  if (appKey) {
    const parts = APPS[appKey].split(' ');
    return action(`Abrindo ${appKey}.`, 'openApp', `Abrir ${appKey}`, { exe: parts[0], args: parts.slice(1).join(' ') });
  }

  const siteCandidates = Object.keys(SITES).sort((a, b) => b.length - a.length);
  const siteKey = siteCandidates.find((key) => wantsOpen(text.indexOf(key)) && text.includes(key));
  if (siteKey) {
    return action(`Abrindo ${siteKey}.`, 'openUrl', `Abrir ${siteKey}`, { url: SITES[siteKey] });
  }

  if (/^arquivo\b|^abrir arquivo/.test(text)) {
    const name = text.replace(/^(abrir|abra)?\s*arquivo\s*/, '');
    return action(`Vou procurar ${name} no computador.`, 'openFile', `Abrir ${name}`, { name });
  }

  let match = text.match(/^(pesquisar|buscar|procurar|pesquisa sobre)\s+(.+)$/);
  if (match) {
    const query = cleanQuery(match[2]);
    return action(`Pesquisando ${query} no Google.`, 'openUrl', `Pesquisar ${query}`,
      { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
  }

  match = text.match(/^(digite|digitar|escreva|escrever)\s+(.+)$/);
  if (match) return action('Vou digitar isso.', 'typeText', 'Digitar texto', { text: cleanQuery(match[2]) });
  match = text.match(/^(aperte|pressione)\s+(.+)$/);
  if (match) {
    const keys = HOTKEYS[norm(match[2])];
    if (keys) return action(`Vou pressionar ${match[2]}.`, 'hotkey', `Pressionar ${match[2]}`, { keys });
  }
  if (/^(tire um print|tire uma captura|capturar a tela|faça um screenshot|print da tela)/.test(text)) {
    return action('Vou capturar a tela.', 'screenshot', 'Capturar tela');
  }

  match = text.match(/^(anote|anotar|salvar nota|guardar nota|lembrete de)\s+(.+)$/);
  if (match) return { intent: 'chat', reply: `Anotei: ${cleanQuery(match[2])}.`, write: { store: 'notes', item: { id: Date.now().toString(), text: cleanQuery(match[2]), done: false, at: new Date().toISOString() } } };
  if (/^(ler notas|mostrar minhas notas|ver notas|listar minhas notas)/.test(text)) {
    return { intent: 'chat', reply: 'Aqui estão suas notas.', data: { type: 'notesList' } };
  }
  match = text.match(/^(criar|adicionar|nova)\s+tarefa\s+(.+)$/);
  if (match) return { intent: 'chat', reply: `Tarefa criada: ${cleanQuery(match[2])}.`, write: { store: 'tasks', item: { id: Date.now().toString(), text: cleanQuery(match[2]), done: false, at: new Date().toISOString() } } };
  if (/^(listar tarefas|mostrar tarefas|minhas tarefas|ver tarefas)/.test(text)) {
    return { intent: 'chat', reply: 'Aqui estão suas tarefas.', data: { type: 'tasksList' } };
  }
  match = text.match(/^(concluir|marcar)\s+tarefa\s+(.+)$/);
  if (match) return { intent: 'chat', reply: 'Concluindo tarefa.', data: { type: 'taskDone', query: cleanQuery(match[2]).replace(/\s+como concluida$/, '') } };

  match = text.match(/^(explicar|me explica|me ensine|resumir|o que e|aprender|estudar|o que voce sabe sobre|me conte sobre|conte sobre|me fale sobre|fale sobre|como funciona|para que serve|pra que serve|o que faz|diferenca entre|compare)\s+(.+)$/);
  if (match) return study(norm(match[2]).replace(/^(o|a|os|as)\s+/, ''));
  match = text.match(/^(flashcards de|cartoes de|quiz de)\s+(.+)$/);
  if (match) {
    const topic = norm(match[2]);
    return simple(`Flashcards de ${topic} prontos. Ponto um: ${KNOWLEDGE[topic] || 'revise o assunto comigo.'}`);
  }

  if (/^(como vender sites|dicas para vender sites|quero vender sites|como precificar um site|quanto cobrar por um site)/.test(text)) {
    return simple('Para vender sites: entenda o problema do cliente antes do preço, descreva entregas e prazos, ofereça três planos e peça parte do valor na assinatura.');
  }
  if (/^(criar proposta|fazer orcamento|gerar proposta)/.test(text)) return proposal(raw);

  if (!options.skipLearned && brain.isEnabled()) {
    const trained = brain.matchLearned(raw, { onlyTrained: true });
    if (trained) return followLearned(trained, options);
    const alias = brain.matchLearned(raw, { onlyBuiltin: true });
    if (alias) return followLearned(alias, options);
  }

  const local = !options.skipBrain && brain.isEnabled() ? brain.respond(raw) : null;
  if (local && !local.unknown) {
    return withBrain(simple(local.reply, { data: local.data }), local.brain);
  }

  const reason = local?.reply || 'Não tenho essa resposta na memória.';
  return withBrain({
    intent: 'chat',
    reply: `${reason} Vou consultar a web e trazer a resposta aqui.`,
    webSearch: { query: raw, reason },
    data: local?.data || null
  }, local?.brain || { source: 'local', confidence: 0.3 });
}

module.exports = { parse, capabilities, safeCalc, proposal, norm };
