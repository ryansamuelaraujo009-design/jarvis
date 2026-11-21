'use strict';

/** Base de treino local: variações de voz para os comandos já existentes. */

const topics = ['javascript', 'html', 'css', 'react', 'node', 'python', 'ingles', 'matematica', 'seo', 'freelance'];
const study = topics.flatMap((topic) => [
  [`explicar ${topic}`, `explicar ${topic}`],
  [`me explica ${topic}`, `explicar ${topic}`],
  [`me ensine ${topic}`, `explicar ${topic}`],
  [`resumir ${topic}`, `explicar ${topic}`],
  [`o que e ${topic}`, `explicar ${topic}`],
  [`o que voce sabe sobre ${topic}`, `explicar ${topic}`],
  [`me conte sobre ${topic}`, `explicar ${topic}`]
]);

const commands = [
  ['o papai chegou', 'oi'], ['acorda criança', 'oi'], ['salve o papai chegou', 'oi'],
  ['bom dia o papai chegou', 'bom dia'], ['boa tarde acorda criança', 'boa tarde'], ['boa noite o papai chegou', 'boa noite'],
  ['obrigado acorda criança', 'obrigado'], ['valeu o papai chegou', 'valeu'],
  ['como vai você', 'como vai'], ['tudo bem com você', 'tudo bem'],
  ['o que você pode fazer', 'ajuda'], ['me mostre o que você faz', 'ajuda'],
  ['quais são os seus comandos', 'ajuda'], ['me ajuda', 'ajuda'], ['socorro', 'ajuda'],
  ['como você funciona', 'como você funciona'], ['como você aprende', 'como você funciona'],
  ['me fale sobre você', 'quem é voce'], ['quem é você', 'quem é voce'],
  ['qual é o seu nome', 'quem é voce'],
  ['me diga as horas', 'que horas são'], ['que horas são agora', 'que horas são'],
  ['qual é a data de hoje', 'que dia é hoje'], ['que dia é hoje', 'que dia é hoje'],

  ['abre o bloco de notas', 'abrir bloco de notas'], ['abra o notepad', 'abrir bloco de notas'],
  ['inicie o bloco de notas', 'abrir bloco de notas'],
  ['abra a calculadora', 'abrir calculadora'], ['inicie a calculadora', 'abrir calculadora'],
  ['abrir explorer', 'abrir explorador'], ['abra o explorador', 'abrir explorador'],
  ['abrir meus arquivos', 'abrir meus arquivos'], ['abrir google chrome', 'abrir google chrome'],
  ['abra o chrome', 'abrir chrome'], ['abra o edge', 'abrir edge'],
  ['abrir navegador padrão', 'abrir navegador padrão'],
  ['abra o vs code', 'abrir vs code'], ['abrir visual studio code', 'abrir visual studio code'],
  ['tocar spotify', 'abrir spotify'], ['abrir discord', 'abrir discord'],
  ['abrir telegram', 'abrir telegram'], ['abrir word', 'abrir word'], ['abrir excel', 'abrir excel'],
  ['abrir powershell', 'abrir powershell'], ['abrir prompt', 'abrir prompt'], ['abrir terminal', 'abrir terminal'],
  ['abrir pasta downloads', 'abrir pasta downloads'], ['abra a pasta de downloads', 'abrir pasta de downloads'],
  ['abrir área de trabalho', 'abrir area de trabalho'], ['abrir documentos', 'abrir documentos'],
  ['abrir arquivo relatorio', 'abrir arquivo relatorio'],

  ['abra o youtube', 'abrir youtube'], ['vamos para o youtube', 'abrir youtube'],
  ['quero ir no youtube', 'abrir youtube'], ['abra o google', 'abrir google'],
  ['ir para o google', 'abrir google'], ['abra o github', 'abrir github'],
  ['quero abrir o github', 'abrir github'], ['abra o gmail', 'abrir gmail'],
  ['abrir meu email', 'abrir gmail'], ['abrir linkedin', 'abrir linkedin'],
  ['abrir instagram', 'abrir instagram'], ['abrir whatsapp', 'abrir whatsapp'],
  ['abrir netflix', 'abrir netflix'], ['abrir figma', 'abrir figma'],
  ['abrir notion', 'abrir notion'], ['abrir chatgpt', 'abrir chatgpt'],

  ['buscar css grid', 'pesquisar css grid'], ['procurar css grid', 'pesquisar css grid'],
  ['pesquisa sobre css grid', 'pesquisar css grid'],
  ['procurar por javascript', 'pesquisar javascript'],

  ['digitar olá mundo', 'digite olá mundo'], ['escreva olá mundo', 'digite olá mundo'],
  ['pressione ctrl c', 'aperte ctrl c'], ['pressione ctrl v', 'aperte ctrl v'],
  ['aperte ctrl z', 'aperte ctrl z'], ['aperte ctrl s', 'aperte ctrl s'],
  ['aperte alt tab', 'aperte alt tab'], ['aperte enter', 'aperte enter'],
  ['aperte esc', 'aperte esc'], ['aperte win d', 'aperte win d'],
  ['mostrar desktop', 'mostrar desktop'], ['minimizar tudo', 'minimizar tudo'],
  ['tire uma captura', 'tire um print'], ['capturar a tela', 'capturar a tela'],
  ['faça um screenshot', 'tire um print'], ['print da tela', 'tire um print'],

  ['anotar comprar cafe', 'anote comprar cafe'], ['salvar nota comprar cafe', 'anote comprar cafe'],
  ['guardar nota comprar cafe', 'anote comprar cafe'], ['lembrete de comprar cafe', 'anote comprar cafe'],
  ['mostrar minhas notas', 'ler notas'], ['ver notas', 'ler notas'], ['listar minhas notas', 'ler notas'],

  ['adicionar tarefa estudar CSS', 'criar tarefa estudar CSS'],
  ['nova tarefa estudar CSS', 'criar tarefa estudar CSS'],
  ['mostrar tarefas', 'listar tarefas'], ['minhas tarefas', 'listar tarefas'],
  ['ver tarefas', 'listar tarefas'], ['o que tenho que fazer', 'listar tarefas'],

  ...study,

  ['dicas para vender sites', 'como vender sites'], ['quero vender sites', 'como vender sites'],
  ['como precificar um site', 'como vender sites'], ['quanto cobrar por um site', 'como vender sites'],
  ['fazer orçamento para Acme de landing page', 'criar proposta para Acme de landing page'],
  ['gerar proposta para Acme', 'criar proposta para Acme de landing page'],

  ['bloquear windows', 'bloquear o pc'], ['travar a tela', 'bloquear o pc'],
  ['silenciar microfone', 'desligar microfone'], ['desativar o mic', 'desligar microfone'],
  ['ligar o mic', 'ativar microfone'], ['desligar a voz', 'desativar voz'], ['ativar a voz', 'ativar voz'],
  ['conte uma piada', 'piada'], ['me conte uma piada', 'piada'],
  ['me motive', 'motivação'], ['estou desanimado', 'motivação'],
  ['sair do assistente', 'fechar assistente'], ['estatísticas', 'como você funciona'],
  ['o que você sabe sobre mim', 'o que você sabe sobre mim'],
  ['fale sobre mim', 'fale sobre mim'], ['quem sou eu', 'quem sou eu'],
  ['seja mais informal', 'seja mais informal'], ['seja mais formal', 'seja mais formal'],
  ['respostas curtas', 'seja mais curto'],
  ['quando eu disser blz, abra o bloco de notas', 'quando eu disser blz, abra o bloco de notas'],
  ['pode abrir o bloco de notas', 'abrir bloco de notas'],
  ['me abra o chrome', 'abrir chrome'],
  ['abre bloco de nota', 'abrir bloco de notas'],
  ['tira um print', 'tire um print'],
  ['como funciona o flexbox', 'explicar flexbox'],
  ['para que serve o git', 'explicar git'],
  ['quanto e o dobro de doze', 'calcule 2 * 12']
];

const facts = [
  ['nome', 'Ryan'], ['projeto', 'Jarvis, assistente de voz local'],
  ['preferencia', 'sem API, sem chave e sem modelo externo'],
  ['idioma', 'portugues do Brasil'], ['sistema', 'Windows'],
  ['trabalho', 'venda de sites e freelance'], ['estudo', 'CSS, SEO e desenvolvimento web'],
  ['objetivo', 'assistente de voz que conversa e aprende com o usuario']
];

const sentences = [
  'JavaScript roda no navegador e tambem no servidor com Node.js',
  'Use const e let em vez de var para declarar variaveis',
  'Promises e async await simplificam codigo assincrono',
  'HTML descreve a estrutura semantica de uma pagina',
  'CSS controla apresentacao e layout com box model flexbox e grid',
  'React constroi interfaces a partir de componentes pequenos',
  'Node.js roda JavaScript no servidor com event loop nao bloqueante',
  'Python e uma linguagem de sintaxe simples usada em automacao e dados',
  'Para vender sites descubra o problema de negocio antes do preco',
  'SEO aumenta a visibilidade organica com tecnica conteudo e autoridade',
  'Pesquise a intencao de busca antes de escrever qualquer conteudo',
  'Treino espacado funciona melhor que maratona na vespera da prova',
  'Constancia vence intensidade faca um pouco hoje e um pouco amanha',
  'O cerebro local aprende com as correcoes que o usuario faz',
  'A memoria fica somente neste computador sem enviar dados para fora',
  'Comandos aprendidos tem prioridade sobre as regras fixas',
  'Cada correcao vira um exemplo de treino para a proxima conversa',
  'A voz e reconhecida localmente com Vosk em portugues do Brasil',
  'A resposta falada usa a voz Maria instalada no Windows'
];

module.exports = { commands, facts, sentences };
