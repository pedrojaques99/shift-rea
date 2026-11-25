# PLAN: editor de fontes open-source, multiplataforma, com IA (engenharia reversa do Glyphs)

> 23/11/2026. Pedido do dono: um Glyphs open-source que rode em qualquer sistema, com IA embutida
> no modelo do jaques-os: o usuário entra com a assinatura que já tem (Claude, GPT, Gemini…) ou
> usa a própria chave (BYOK). A IA deve fazer de tudo: criar, lapidar, espaçar, kerning, variações,
> scripts, auditoria e exportação.
> O nome do produto ainda não foi escolhido. "REA" é só a sigla de engenharia reversa.

## 0. Como fazer a engenharia reversa sem Mac

O Glyphs é fechado e só roda no macOS, então **não abrimos o binário**: seria inviável aqui e
juridicamente arriscado. A engenharia reversa é **clean-room**, feita só a partir de material público:

| Fonte pública | O que entrega |
|---|---|
| glyphsapp.com/learn e handbook.glyphsapp.com | o que a ferramenta faz e como se usa (as cerca de 20 aulas essenciais estão no §7) |
| `schriftgestalt/GlyphsSDK` (Apache-2.0) | especificação do formato `.glyphs` v2/v3 e da API Python (GSFont → GSGlyph → GSLayer → GSPath → GSNode); modelos de plugin |
| `schriftgestalt/GlyphsInfo` (BSD-3) | o GlyphData que o próprio Glyphs usa: nomes, Unicode, categorias e **receitas de decomposição** (`a+acutecomb=aacute`) |
| `schriftgestalt/glyphs-packages` | o catálogo de todos os plugins e scripts da comunidade, que funciona como mapa do que os designers pedem (cada item tem licença própria) |
| `schriftgestalt/FontTechKnowledge` (CC-BY-SA) | particularidades de fontes e de software |
| `mekkablue/Glyphs-Scripts` (Apache-2.0, 352 scripts) | os fluxos reais do dia a dia, viram receitas da IA (§4) |

Um sinal útil: a equipe do Glyphs mantém forks do `fontc` e um plugin que exporta com o fontc.
Ou seja, o próprio Glyphs está migrando para o compilador que vamos usar.

## 1. Veredito: base = **Shift**, sem fork pesado do Fontra e sem começar do zero

A pergunta era se o Fontra é o que existe de mais avançado, ou se dá para fazer algo melhor do zero em
outra linguagem. Resposta: **a stack mais moderna hoje é núcleo em Rust com interface web, e já existe um
editor nela, com licença permissiva**. Começar do zero levaria cerca de 1,5 a 2 anos com 2 ou 3 pessoas
só para chegar ao nível do que já existe.

| | **Shift** | Fontra | Counterpunch | Do zero |
|---|---|---|---|---|
| Stack | **Rust** (fontations, fontc, kurbo) + **React 19 / Tailwind 4 / shadcn**, Electron | Python aiohttp + JS puro, Canvas2D | TS + Rust/WASM (babelfont) | Rust + web |
| Licença | **MIT/Apache** | GPL-3 | GPL-3 com exceção para plugins | nossa |
| Instaladores Win/Mac/Linux | ✅ | ✅ (Fontra Pak) | web | — |
| Variáveis, componentes, importar .glyphs | ✅ | ✅ (escrita do .glyphs parcial) | ✅ | — |
| Kerning e prova de texto | planejado | ✅ | ✅ | — |
| IA / MCP | MCP **só leitura** já existe | nada | assistente + Python | — |
| GlyphsInfo embutido | ✅ | — | — | — |
| Bus factor (pessoas sem as quais o projeto para) | 1 (kostyafarber) | 1 (Just van Rossum, 95% dos commits) | 1 (yanone) | nós |

**Por que o Shift**
- O núcleo em Rust é exatamente a stack que a pesquisa indicou como a melhor hoje.
- A interface usa React, Tailwind e shadcn (`components.json` na raiz), então **o registry da Visant
  encaixa direto**.
- A licença permissiva deixa o produto e a camada de IA livres. Os temas são arquivos simples.
- O MCP só de leitura já está pronto: falta abrir a escrita.

**Por que não o Fontra:** GPL, interface sem framework (difícil de redesenhar), Canvas2D, sem scripts,
e um único dev responsável por 95% dos commits.

**Counterpunch:** é a melhor referência do que a IA pode fazer dentro de um editor. Fica como
benchmark, não como base, por causa da GPL.

**Tarefa da semana 1:** antes de escrever código, instalar Shift, Counterpunch e Fontra Pak no Windows
e passar a mesma fonte de teste pelos três (§6, fase 0).

## 2. Peças (o que compõe o app, tudo validado)

| Camada | Peça | Licença | Papel |
|---|---|---|---|
| Modelo e geometria | fontations (read/write-fonts, skrifa), kurbo, norad | Apache | já estão no Shift |
| Ler e gravar .glyphs | babelfont-rs / glyphs-reader do fontc, **glyphsLib** (Python) | Apache | ida e volta fiel com o Glyphs; o glyphsLib serve de referência e de teste |
| Compilar TTF e variável | **fontc** 2.x | Apache | caminho principal, já no Shift |
| Compilar CFF/OTF, CFF2, estáticas | **fontTools/fontmake** + **AFDKO** (`makeotf`, `tx`, `cffsubr`) | MIT / Apache | o fontc ainda não gera CFF |
| Hinting | **otfautohint** (AFDKO) para PS, **ttfautohint** para TT | Apache / FreeType | botão "auto-hint" na exportação |
| Shaping e prova | harfrust (nativo) e harfbuzzjs (web) | MIT | prova de texto e preview de features |
| Validação de qualidade | **fontspector** (sucessor do fontbakery, Rust), **pyots** (sanitizer), **diffenator2** | Apache / BSD | a "auditoria" que a IA roda e explica |
| Cobertura de caracteres | **glyphsets** (Google), charsets da Adobe, GlyphsInfo | Apache / BSD | dizer o que falta e gerar |
| Espaçamento base | **HTLetterspacer** | **GPL-3** | só como processo externo (CLI) para não contaminar a licença; ou reimplementar o algoritmo, que é público |
| Fonte colorida | **nanoemoji** | Apache | COLRv0/v1 |
| Prova impressa | drawBotProofing (Adobe) | ver | PDF de prova |
| Scripts | sidecar Python + **shim `GlyphsApp`** em cima do glyphsLib | nosso | rodar os scripts do mekkablue e da comunidade |
| Interface | registry Visant (shadcn) + design system da Visant | nosso | o Shift já é shadcn |

Ponto delicado: Electron ou Tauri. O Shift usa **Electron**, e a gente fica com ele. O Tauri renderiza
diferente em cada sistema, e trocar não paga o custo. Também segue o padrão do skill `visant-app`.

## 3. Camada de IA (agnóstica de assinatura, igual ao jaques-os)

Repete a decisão do `jaques-os/PLANO-agente.md`: **o app conversa com o CLI que o usuário já tem
logado**, sem escrever um loop próprio sobre a API.

1. **Provedores**
   - CLI com login: `claude` (Claude Code), `codex` (OpenAI), `gemini` (Gemini CLI). O app detecta quais
     estão instalados e usa a assinatura do usuário, sem chave.
   - BYOK: chave da Anthropic, OpenAI, Google, OpenRouter ou modelo local (Ollama), via **Vercel AI
     SDK**, que já é um adaptador multi-provedor validado. A chave fica no cofre do sistema (keytar ou
     safeStorage do Electron), nunca em arquivo.
2. **MCP de edição.** É o coração da camada. O MCP do Shift hoje só lê; vamos estendê-lo com
   **operações tipadas que passam pelo mesmo undo da interface**:
   `glyph.create`, `path.edit`, `component.add`, `anchor.set`, `metrics.set`, `kerning.set`,
   `master.add`, `axis.add`, `feature.write`, `export.run`, `audit.run`, `script.run`.
   Qualquer CLI (Claude, Codex, Gemini) e o modo BYOK usam as mesmas ferramentas, e o designer vê
   a edição acontecer ao vivo e pode desfazer.
   - **Antes de abrir PR no Shift**, conversar com o mantenedor. O MCP é só leitura por decisão dele,
     então a escrita pode virar uma opção desligada por padrão.
3. **Receitas** (skills do agente), cada uma com ferramentas e prova:

   | Receita | O que faz | Base |
   |---|---|---|
   | Criar | gerar glifos que faltam por receita (acentos, frações, versaletes) e esboçar novos a partir dos existentes | GlyphsInfo, receitas, scripts do mekkablue |
   | Lapidar | caminhos limpos: extremos, direção, harmonização G2, compatibilidade entre masters | kurbo, scripts de Paths |
   | Espaçar | proposta de sidebearings com justificativa | HTLetterspacer (CLI) + heurística + revisão visual |
   | Kerning | grupos, pares e exceções, com provas geradas | kern-dump, prova HarfBuzz |
   | Variações | eixos, masters, intermediários, instâncias e STAT | fontc |
   | Scripts | o pedido em linguagem natural vira Python no shim `GlyphsApp` | 352 receitas do mekkablue como exemplos |
   | Auditar | fontspector + pyots + diffenator2, e a IA explica e corrige | — |
   | Exportar | TTF/OTF/variável/web, com hinting e validação | fontc / fontmake / AFDKO |

4. **Entradas**, iguais ao jaques-os: texto, áudio (ditado), rabisco (vira esboço de glifo) e imagem
   (referência para traçar).
5. **Geração de glifo por modelo** (VecGlypher, DesigNet) é pesquisa e não entra no MVP. Fica atrás de
   uma flag, sempre seguida de uma limpeza de pontos e compatibilidade.

## 4. Compatibilidade com o ecossistema Glyphs (o que faz alguém migrar)

- **Abrir e salvar `.glyphs` e `.glyphspackage` sem perder nada.** Teste automático: abrir, salvar,
  comparar com o glyphsLib usando as fontes de teste do próprio glyphsLib e do fontc.
- **Shim `GlyphsApp` em Python.** Um módulo com `GSFont`, `GSGlyph`, `GSLayer`, `GSPath`, `GSNode`,
  `Glyphs.font`… em cima do modelo do app, via sidecar Python, ligado ao núcleo Rust por
  JSON-RPC.
  - Meta: os scripts do mekkablue **que não abrem janela** rodam sem mudança.
  - Os que usam `vanilla`/PyObjC (macOS) ganham uma janela gerada a partir dos parâmetros.
  - Métrica de progresso: quantos dos 352 scripts passam.
- Nomes de glifo, receitas e categorias pelo GlyphsInfo, que o Shift já usa.
- **Plugins do mekkablue** (cerca de 50 repositórios, os que conferi são Apache-2.0). Viram recursos nativos,
  porque plugin depende de desenhar na tela e de filtro, o que não roda pelo shim de scripts. Podemos
  portar a lógica (com crédito) ou reimplementar.
  - Visualização ("Reporters"): ShowInterpolations, ShowAngledHandles, ShowTopsAndBottoms,
    ShowMetricsKeys, ShowMarkPreview, ShowItalic, Symmetry, ShowFilledPreview. Viram camadas
    ligáveis do canvas, e a IA também lê o que elas mostram ("tem alça torta no `g`").
  - Filtros de lapidar: InsertInflections, MakeCorner, FixZeroHandles, GreyHarmony,
    MagicItalic (itálico com correção), UnnestComponents. Entram na receita "Lapidar".
  - Efeitos e geração: BroadNibber (pena larga), Noodler, Inliner, Stitcher, Shadow, Pixelate,
    Risorizer. Entram na receita "Criar e variações": esqueleto → fonte.
  - Exportação: BetterVFExport (controle de STAT/fvar), ExportVarWithKern. Entram em "Exportar".
  - Mapa geral: `schriftgestalt/glyphs-packages/packages.plist` lista todos os plugins da
    comunidade. Cada um precisa ter a licença conferida antes de portar.

## 4b. Regra de licença: uso comercial sem amarra

O dono quer projeto público, crédito só no fork, e uso comercial tranquilo. A regra:

- **Código que entra no app só pode ter licença permissiva:** MIT, Apache-2.0, BSD ou OFL (para fontes de teste).
  O crédito fica em `THIRD_PARTY_NOTICES.md`, que o Shift já tem.
- **Nosso app sai MIT/Apache-2.0 dual**, igual ao Shift.
- **GPL não entra no código** (Fontra, Counterpunch, FontForge, HTLetterspacer). Só serve de referência
  de comportamento, ou roda como **programa externo opcional** que o usuário instala por conta própria.
- **Licenças que conferi:**
  - permissivas, entram: Shift, fontc, fontations, glyphsLib, fontTools, AFDKO (Apache), pyots (BSD),
    fontspector, glyphsets, nanoemoji, babelfont-rs, GlyphsSDK, GlyphsInfo (BSD), mekkablue (Apache);
  - ttfautohint é FreeType License, pede crédito e pode entrar;
  - FontTechKnowledge é CC-BY-SA: só como leitura, não copiar trechos.
- **Pendente:** uma verificação automática no CI (`cargo deny` já está no Shift, mais `license-checker` para
  o npm) que falha se entrar dependência GPL.

## 5. Paridade com o Glyphs 4 (cada item da lista → como fazemos)

| Glyphs 4 | Nosso caminho | Peças |
|---|---|---|
| Editar glifos no contexto de uma palavra | editor em linha de texto com shaping real | harfrust/harfbuzzjs; o Shift já tem modo de texto |
| Visão de fonte e de edição numa janela só | layout único: grade ↔ edição como zoom, sem trocar de janela | interface nossa (Visant) |
| Ferramentas de desenho intuitivas e poderosas | as do Shift + régua, faca, primitivas, harmonização | kurbo |
| Área de trabalho personalizável | painéis encaixáveis + temas em arquivo | Shift themes + registry Visant |
| Centenas de plugins e scripts gratuitos | shim `GlyphsApp` + plugins do mekkablue como nativos + SDK de plugin TS | §4 |
| Pen points / traço único com espessura variável | esqueleto + caneta variável (largura, ângulo, ease) → contorno | kurbo offset/stroke; BroadNibber/Noodler/Inliner como referência |
| Grandes conjuntos de ícones com formas reutilizáveis | componentes + tipo de fonte "iconSet" + exportação de imagem | §5 exportação |
| Controle de Bézier avançado (curvatura em lote, harmonização, balancear alças) | operações em lote no núcleo Rust | kurbo; GreyHarmony/GreenHarmony (referência) |
| Preview de interpolação, features e textos longos com cor, tracking e entrelinha | painel de prova ao vivo, compilando a cada edição | fontc em memória + harfrust |
| Grupos de kerning visuais, kerning contextual | modo de kerning + grupos em cor + feature contextual gerada | o Shift ainda não tem: construir |
| Escrever Python e editar scripts instalados | painel de macro (Python sidecar) + editor de código (CodeMirror/Monaco) | shim `GlyphsApp` |
| Exportar CFF, CFF2, TTF, WOFF, WOFF2 (estáticas e variáveis) | TTF e variável pelo fontc; CFF/CFF2/estáticas pelo fontmake+AFDKO; WOFF/WOFF2 pelo fontTools | §2 |
| Exportar imagens PNG, SVG, PDF, SF Symbols | renderizar com skrifa → SVG/PNG; PDF com fontTools/drawBot-like; SF Symbols por template | GlyphsSDK SFSymbolTemplate (referência) |
| Todos os formatos de cor: COLRv0/CPAL, COLRv1, SVG, sbix, fontes em camadas | camadas de cor no modelo + exportação | **nanoemoji** (Apache), fontTools `colorLib` |

### Interface e experiência melhores que as do Glyphs

O alvo não é igualar, é **mais limpo, mais visual, com acabamento de ofício**:

- **Princípio:** tudo que o Glyphs mostra em painel de números, a gente mostra **no próprio desenho**
  (métricas, kerning, interpolação e problemas de qualidade como camadas visuais).
- **Processo:** skills `visant-design` → `visant-frontend` (tabela de rotas) → `visant-motion` →
  `visant-killer` como portão antes de cada PR, sempre verificando na tela real.
- **Componentes:** registry Visant (shadcn), já compatível com o `components.json` do Shift.
- **Performance como parte da experiência:** 60 fps no canvas com fonte grande; meta medida nos
  testes `test:perf` do Shift.

## 5b. Escopo por fase (resumo; o inventário completo está em `INVENTARIO-glyphs.md` a criar)

- **[core] no MVP:** desenho, nós e segmentos, booleanas, componentes e âncoras, masters, eixos e instâncias,
  métricas, espaçamento, kerning com grupos, features automáticas + editor .fea, exportação TTF/OTF/variável/web,
  Font Info, visão de fontes e de edição, prova de texto.
- **[pro] na v1:** metric keys (`=H+10`), camadas intermediárias e alternadas, smart/variable components,
  componentes de canto, terminal e segmento, tokens de feature, hinting, filtros (offset, round
  corners), COLR, painel de macro com Python.
- **[niche] depois:** pixel fonts, ícones/SF Symbols, sbix/SVG.

## 6. Fases

| Fase | Entrega | Prova de pronto |
|---|---|---|
| 0. Avaliação (1 semana) | Shift, Counterpunch e Fontra Pak instalados no Windows; uma fonte .glyphs real passa pelos três | tabela de ida e volta do .glyphs + vídeo; base confirmada ou trocada |
| 1. Base | fork leve do Shift + tema Visant (registry) + build de instalador Windows | instalador abre, edita e salva uma UFO; tela vista |
| 2. MCP de edição | operações tipadas com undo; Claude Code conectado edita um glifo ao vivo | e2e: o agente cria `aacute` por receita e o undo desfaz |
| 3. Provedores | detectar CLIs + BYOK (AI SDK) + painel de chat com entradas | mesma tarefa via Claude, Codex e BYOK; teste com CLI falso (sem gastar token) |
| 4. Receitas 1 | criar, lapidar, auditar e exportar | fonte de teste sai OTF+TTF+variável e passa no fontspector |
| 5. Receitas 2 | espaçar, kerning, variações | prova HarfBuzz antes e depois |
| 6. Shim GlyphsApp | sidecar Python + bateria com os 352 scripts | relatório: N de 352 rodam |
| 7. Paridade pro | itens [pro] do §5, por ordem de pedido | — |

## 6b. Estado em 23/11/2026

**Feito (fases 1 e 2 técnicas):**
- O Shift compila a partir do código no Windows, sem admin: Node 24 (fnm), Rust **GNU** + MinGW (WinLibs).
  Basta `source env.sh`. Pré-requisito único: `rustup set default-host x86_64-pc-windows-gnu`.
- **MCP de edição:** `shift.edits.apply({ windowId, label, intents, ifFontRevision? })`.
  - Aplica qualquer `FontIntent` do motor (cerca de 70 operações) como **um passo de desfazer**, pelo mesmo
    caminho da interface (`font.editCoordinator.apply`). Placeholders `new:<prefixo>:<chave>` viram IDs novos.
  - Erros tipados: `FontEditRefusedError`, `FontEditUnavailableError` e `FontEditPlaceholderError`.
  - O `shift.describe` expõe o esquema completo dos `FontIntent`.
  - O guia ganhou o tópico `editing` (fluxo de type design), e a `SKILL.md` e as instruções do servidor agora dizem que o MCP edita.
- Testes: 3 de integração (motor real) + 1 do sandbox. Agente de 10/10, MCP 9/9, sandbox 30/30. Typecheck ok.
- Prova ao vivo: o H e o I foram desenhados pelo MCP no app aberto (`scripts/demo-HI.js`, `scripts/shift-exec.sh`).

**Correções de Windows no fork (candidatas a PR upstream):**
- `shift-bridge`: `dyn-symbols` no alvo GNU, e o build copia o addon GNU para o nome que o loader procura.
- `generate-bridge-types.mjs` aceita CRLF; `generate-code-api.mjs` usa shell no Windows (`pnpm.cmd`).
- `DocumentStorage.deleteWorkspace`: no Windows, uma pasta ainda aberta fica para trás com aviso, em vez de derrubar o fechamento.
- Repo com `core.autocrlf=false` (o checkout com CRLF quebrava os geradores).

**Pendências conhecidas:**
- Lint upstream pré-existente em `emptyMemorySession.ts` e `TestEditor.ts`.
- O texto de prova numa página não apareceu no canvas (a investigar).
- Commit e PR ainda não feitos (aguardando o dono).

## 7. Aulas do Glyphs que guiam a paridade

drawing-good-paths · edit-view · adding-glyphs-to-your-font · getting-your-glyph-names-right ·
spacing · kerning · diacritics · mark-attachment · multiple-masters (1–3) · creating-a-variable-font ·
intermediate-layers · switching-shapes · smart-components · reusing-shapes-corner-components ·
features (1–4) · tokens · vertical-metrics · naming · custom-parameters ·
hinting-truetype-autohinting · scripting-glyphs (1–4) · plugins · creating-a-microsoft-color-font
(todas em `https://glyphsapp.com/learn/<slug>`)

## 8. Riscos

- **Bus factor 1 no Shift.** Mitigação: fork leve que acompanha o upstream; nossas mudanças ficam em
  pacotes separados (tema, MCP de escrita, provedores) e vão para o upstream quando der.
- **Shift ainda é alpha** e não tem kerning nem prova de texto. É justamente o que vamos construir,
  mas é trabalho de verdade.
- **O fontc não gera CFF.** Fallback: fontmake/AFDKO.
- **HTLetterspacer é GPL.** Só como processo externo, ou reimplementar o algoritmo público.
- **Não existe modelo aberto de kerning** de produção. Começar por heurística + prova + o olho do designer.
- **Licença dos plugins do glyphs-packages:** cada um tem a sua; copiar só o que for permissivo.

## 9. Decisões pendentes do dono

1. Confirmar o Shift depois da fase 0 (ou trocar pelo Counterpunch, se a IA dele surpreender).
2. Licença do nosso app: MIT/Apache (comunidade) ou fechar a camada de IA.
3. Nome do produto.
4. Conversar com o mantenedor do Shift: contribuir com o upstream ou só fazer fork.

## Visant Sans (meta do /goal, 24/11/2026)

Família variável derivada da Manrope (OFL), **pronta e burilada**: mais moderna sem perder a
elegância e a simplicidade. Feita com o Shift e com o agente dele.

- Eixos: `wght` 200–800, mais itálico (`ital` verdadeiro ou `slnt`), STAT completo, instâncias
  nomeadas, `.ttf` e `.woff2` variáveis, QA com fontbakery.
- Espaçamento +4%, kerning GPOS refeito, compatibilidade de masters validada a cada lote.
- Desenho glifo a glifo (aberturas, terminais, contraste óptico), com provas em PNG por peso e
  CHANGELOG por glifo.
- Pasta: `Z:\Cursor\glyphs-rea\manrope-derivative\` (repo local próprio). Guia de produção em `PRODUCTION.md`.
- O que faltar no Shift para fazer isso vira item do produto.

## Lacunas do Shift (do trabalho na Visant Sans)

Achadas ao produzir a Visant Sans (`manrope-derivative/`, ver `PRODUCTION.md` §9), com o `shift-cli` 0.2.0 do fork `rea`:

1. `compile` perde o bit 7 do fsSelection (USE_TYPO_METRICS), mesmo com ele na fonte, e não marca REGULAR: a altura de linha muda entre Windows e Mac.
2. `compile` não escreve o name ID 25 (prefixo PostScript das variações) nem gasp/prep para fonte sem hinting.
3. Componente espelhado sobreposto a contorno compila com buraco (o sentido do contorno não é invertido ao decompor), e o `check` não avisa. Prova: `manrope-derivative/proofs/00-shift-compile-sources.png`.
4. O `check` O005 acusa falso positivo num contorno dentro de um furo (©, ligadura "(>)").
5. `compile` num `.designspace` falha com "sqlite error: file is not a database", em vez de pedir `import` antes.
6. O MCP não abre documento em janela nova: um agente não consegue trabalhar em paralelo ao dono sem mexer na janela dele.
7. Falta remover sobreposição de forma compatível entre masters (cada master sai com estrutura diferente). O `manrope-derivative/scripts/compatunion.py` resolve: chaves por vértice original ou cruzamento de contorno A→B, e divisão exata onde falta nó. Candidato a operação do Shift.
8. Faltam edições que preservem a compatibilidade: aparar terminal com corte exato de Bézier, mover nó com as alças, escalar contorno (`scripts/glyphedit.py`). Candidatas a intents do `shift.edits.apply`.
9. Ponto positivo: `compile` leva 0,8 s para 3 eixos e 12 masters, contra cerca de 1 min no fontmake. É o caminho certo para o ciclo editar → prova, assim que os itens 1-3 estiverem resolvidos.
10. `shift-cli check` ignora eixos discretos: num designspace com `ital` 0/1 compara os masters romanos com os itálicos e acusa 72 falsos erros I002 (incompatible-master). Cada valor de um eixo discreto é uma fonte variável separada (achado no build Roman + Italic da Visant Sans).
