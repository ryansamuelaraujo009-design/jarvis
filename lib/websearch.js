'use strict';

/** Busca HTML direta (DuckDuckGo Lite) — sem API, sem chave, sem navegador. */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JarvisVoice/1.0';

const ENTITIES = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  atilde: 'ã', otilde: 'õ', ccedil: 'ç', agrave: 'à', egrave: 'è',
  ecirc: 'ê', ucirc: 'û', ordf: 'ª', ordm: 'º'
};

function decodeHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#0*39;/gi, "'")
    .replace(/&([a-z]+);/gi, (full, name) => ENTITIES[name.toLowerCase()] || full)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const clip = (value, max) => {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
};

function parseResults(html, limit = 3) {
  const source = String(html || '');
  const results = [];
  const pattern = /<a[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  while ((match = pattern.exec(source)) && results.length < limit) {
    const title = decodeHtml(match[1]);
    if (!title) continue;
    const near = source.slice(match.index, match.index + 3000);
    const domain = /<span[^>]*class=['"]link-text['"][^>]*>([\s\S]*?)<\/span>/i.exec(near);
    results.push({
      title: clip(title, 120),
      snippet: clip(decodeHtml(match[2]), 240),
      domain: domain ? clip(decodeHtml(domain[1]), 100) : ''
    });
  }
  return results;
}

async function search(query, options = {}) {
  const question = String(query || '').trim();
  if (!question) return [];
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(question)}&kl=br-pt`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    signal: AbortSignal.timeout(options.timeout || 12000)
  });
  if (!response.ok) throw new Error(`busca retornou ${response.status}`);
  return parseResults(await response.text(), options.limit || 3);
}

function speakable(results, query, saved = 0) {
  if (!results?.length) return `Não encontrei nada na web para "${query}".`;
  const first = results[0];
  const parts = [`Encontrei isto: ${first.snippet || first.title}`];
  if (results[1]) parts.push(`Também diz: ${results[1].snippet || results[1].title}`);
  if (saved > 0) parts.push('Guardei isso na memória para a próxima vez.');
  return parts.join(' ');
}

module.exports = { search, parseResults, speakable, decodeHtml };
