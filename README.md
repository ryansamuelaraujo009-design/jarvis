# J.A.R.V.I.S. — Assistente de Voz Local

> 🚧 **Beta** — projeto em desenvolvimento ativo. Funciona no Windows, mas ainda pode mudar bastante. Feedback e sugestões são bem-vindos.

Assistente de voz que roda **inteiramente neste PC**: um holograma compacto no canto superior direito fica ouvindo microfone, reconhece português com Vosk e responde em voz alta usando a síntese de voz do próprio Windows.

**Sem API, sem chave, sem serviço de IA externo e sem modelo remoto.**

## Requisitos

- Windows 10 ou 11
- Node.js 18+ (com npm)
- Python 3.10+ com `sounddevice` e `vosk`
- Modelo Vosk pt-BR (versão small)
- Uma voz pt-BR instalada no Windows (por exemplo, **Microsoft Maria Desktop**)

## Instalação

```powershell
npm install
python -m pip install sounddevice vosk
```

Baixe o modelo de voz e coloque em `%APPDATA%\jarvis-assistente`:

```powershell
$dest = "$env:APPDATA\jarvis-assistente"
New-Item -ItemType Directory -Force $dest | Out-Null
Invoke-WebRequest "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip" -OutFile "$dest\model.zip"
Expand-Archive "$dest\model.zip" -DestinationPath $dest
Remove-Item "$dest\model.zip"
```

Depois:

```powershell
npm start
```

> O modelo e a memória ficam em `%APPDATA%\jarvis-assistente`, fora da pasta do projeto. O `node_modules` não vai para o repositório.

## Como usar

1. Rode `npm start`.
2. O reator aparece no canto superior direito e já começa ouvindo.
3. Diga **“o papai chegou”** ou **“acorda criança”** para iniciar a conversa.
4. Enquanto a conversa está ativa (60 segundos), fale normalmente — ele responde por voz.
5. Diga **“pare”**, **“silêncio”** ou **“encerrar”** para sair do modo conversa.

Atalhos:

- `Ctrl+Shift+J` — liga/desliga o microfone.
- `Ctrl+Shift+Q` — encerra o assistente.
- Clique no holograma — liga/desliga o microfone.
- Botão direito no holograma — menu com treinar, limpar memória, parar fala e sair.

## Conversa

- Reconhece voz em português do Brasil com Vosk, apenas neste PC.
- Responde com uma voz local do Windows (Maria, com fallback para outras vozes instaladas).
- Cérebro local com TF-IDF + cosseno, Markov, memória persistida e aprendizado.
- Se não sabe, busca na web (HTML do DuckDuckGo, sem API e sem abrir navegador), fala os trechos e guarda o que aprendeu para a próxima vez.
- Entende “mais”, “continue”, “explique melhor”, “repita” e “por que?” sobre o último assunto falado.
- Interpreta variações naturais: “pode abrir...”, “me abra...”, “abre bloco de nota”, “como funciona o flexbox”, “para que serve o git”.
- Faz contas em palavras: “quinze mais vinte e cinco”, “o dobro de doze”, “metade de duzentos”.
- Executa comandos: abrir apps/sites, contas, horas, notas, tarefas, print, propostas e atalhos de teclado.

Exemplos:

```text
o papai chegou, bom dia
acorda criança, quanto é 15% de 240
o papai chegou, explique CSS
mais
acorda criança, crie uma tarefa estudar SEO
o papai chegou, como funciona o wifi
por que?
pare
```

## Áudio

- Captura em blocos de 250 ms e `latency="low"` no microfone.
- Noise gate, remoção de offset DC e ganho automático leve antes do Vosk.
- Filtro por confiança das palavras para evitar frases falsas vindas de ruído; áudio duvidoso gera um pedido educado para repetir.
- Correções automáticas de erros comuns do modelo pequeno: “abre bloco de nota”, “tira um print”, “anota” etc.
- A frase de ativação é detectada já no áudio parcial, com resposta apenas visual, para não cortar o comando que vem logo depois.
- Variações de ativação aceitas: “papai chegou”, “o papai chego”, “acorda a criança”.
- Números falados por extenso viram dígitos: “quinze por cento de duzentos e quarenta” → `15% de 240`.
- O microfone é silenciado enquanto o assistente fala, evitando eco e falsos gatilhos.
- A voz pt-BR é escolhida entre as instaladas, com fala acelerada (`Rate 3`) e motor aquecido, sem reiniciar o PowerShell a cada resposta.

## Estrutura

```text
main.js                 # orquestra voz, conversa, web, ações e janela holográfica
preload.js              # ponte renderer <-> main
lib/brain.js            # memória, TF-IDF, Markov e aprendizado web
lib/engine.js           # interpretação de comandos com respostas faláveis
lib/speech.js           # gerenciador do reconhecedor Vosk (Python)
lib/vosk_listener.py    # captura e limpeza do microfone
lib/speech-normalize.js # números por extenso e correções de transcrição
lib/wake.js             # frases de ativação
lib/tts.js              # voz local do Windows (PowerShell aquecido)
lib/actions.js          # ações no Windows
lib/store.js            # JSON em %APPDATA%\jarvis-assistente
src/                    # holograma (HTML/CSS/JS)
```

## Verificação

```powershell
npm run check
npm test
npm run train
```

São **56 testes**: 32 do interpretador, 10 do cérebro, 1 do parser de busca e 13 de normalização/ativação de voz.

## Limites

Ele conversa usando regras, memória e o que aprende com as buscas que você provoca. Não é um modelo de linguagem gigante: isso exigiria GPU, gigabytes ou API, que foram excluídos de propósito.

---

Projeto do portfólio [DEV.programier](https://ryansamuelaraujo009-design.github.io/).
