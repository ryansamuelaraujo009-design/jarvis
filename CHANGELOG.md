# Histórico de versões

## Beta — novembro de 2026

### Interpretador
- Frases de ativação `o papai chegou` e `acorda criança`, com variações toleradas.
- Variações naturais de comando (`pode abrir`, `me abra`, `abre bloco de nota`).
- Contas em palavras (`quinze mais vinte e cinco`, `o dobro de doze`, porcentagens).
- Aliases de estudo para CSS Grid, Flexbox, box model, Git, APIs, banco e negociação.
- `explique` / `me explique` adicionados aos gatilhos de explicação.

### Áudio
- Captura em blocos de 250 ms com `latency="low"`, noise gate e ganho automático.
- Números por extenso convertidos antes da interpretação.
- Correções de transcrição do Vosk pequeno e aviso em áudio duvidoso.
- Ativação detectada no áudio parcial, com confirmação visual para não cortar o comando.
- Microfone silenciado durante a fala.

### Fala
- Motor PowerShell aquecido, voz pt-BR preferida e taxa `Rate 3`.
- Recuperação automática se o processo de fala cair no meio de uma resposta.

### Demo e portfólio
- Demo web responsiva com o mesmo interpretador local, reconhecimento de voz do navegador e voz do aparelho.
- Cartão do projeto no portfólio com selo Beta, imagem e link para a demo.

### Correções de robustez (nov/2026)
- `stop()` + `speak()` não criam mais workers PowerShell órfãos; worker que cai no meio da fala não prende o microfone.
- "desligar microfone" e "desativar voz" agora são aplicados de fato e sobrevivem ao reinício.
- "desativar cérebro" persiste; "pare.", "silêncio!" e "para de falar" interrompem a fala sem confundir "para que serve o git".
- "crie uma tarefa estudar SEO" volta a salvar; "esqueça a" não apaga memória em massa.
- Escrita atômica do JSON evita perda da memória se o app cair durante um salvamento.
- Reset do recognizer ao silenciar evita eco da própria voz virar comando.
- Ações que pedem confirmação nunca mais são anunciadas como executadas.
- Texto ditado escapa caracteres especiais do SendKeys (`100%`, `a+b`).

### Verificação
- 60 testes automatizados: 35 interpretador, 11 cérebro, 1 busca, 13 voz/ativação.
- Modelo de GitHub Actions incluído em `ci/verificar.yml` (basta mover para `.github/workflows/` com um token que tenha escopo `workflow`).
