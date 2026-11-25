# UX: polimento de ponta a ponta, rota por rota

> Pedido do dono (23/11/2026): "nesse mesmo padrão de craft e refinamento, continue rota a rota,
> componente por componente, jornada por jornada, até ficar 100% burilado a UI/UX end to end".
>
> Regras de toda passada:
> - **Reusar antes de criar.** A ordem de busca é: registry `@visant`
>   (https://ui.visantlabs.com/llms.txt), depois o kit do jaques-os (`Z:\Cursor\jaques-os\app\src\components\ui`),
>   depois os componentes do Shift. Criar do zero só se nada disso servir, e dizendo o porquê.
> - O kit fica em `apps/desktop/src/renderer/src/components/visant/`. A ponte de tokens está no fim do
>   `index.css`. Uma região que usa as cores do kit leva a classe `visant-kit`.
> - Skills: `visant-design` (o que a tela precisa conseguir), `visant-motion` (curvas e durações),
>   `visant-refine` (anatomia de controles e painéis) e `visant-killer` como portão no fim de cada rota.
> - Prova é **tela vista** (CDP na porta 9333, com print), mais teste de comportamento quando há lógica.
> - Um agente por vez em cada área, sem commit da parte dele; eu verifico e faço o commit.
> - Repo: https://github.com/pedrojaques99/shift-rea (privado, branch `rea`); push a cada passada verificada.

## Já feito

| Área | O que mudou | Commit |
|---|---|---|
| Chat do agente | kit `@visant` (prompt-composer, software-glyph, working-glyph), markdown, anexos | eac748d94 |
| Painel do agente | botão no header, painel à direita, sem empurrar a barra direita | eac748d94 |
| Conversas | persistem por documento (JSONL), sobrevivem a reinício | 0cff43ea1 |
| Desfazer | Ctrl+Z num campo vazio desfaz a fonte | 15a3f9a7c |
| Inputs numéricos | scrub estilo Figma, contas, chaves de métrica | e23569b66 |
| Sliders e scrub canônicos | `inspector-controls` do jaques-os, visual do `@visant/scrub-input` | b6febd60e |
| Agente sem glifo aberto | painel na grade de glifos, sugestões para fonte vazia | 503c495b7, 4715b79ac |
| Logos dos provedores | `software-glyph` do kit no seletor de agente | b97c18398 |
| Renomear pelo título | duplo clique em família ou arquivo; o arquivo antigo vai para a lixeira | 9a803ed2d |
| Rota 1: launcher | `@visant/empty-state`, setas nos recentes, soltar fonte para abrir (`@visant/drop-overlay`) | 687557ecc, 1c1ebdfda |
| Cursores do canvas | selo vazado no hover (ponto, alça, âncora, segmento, componente), cheio no arraste; pen-close | c1a04da14 |
| Smart guides | avanço, overshoot, distâncias iguais (hastes), simetria; pílula Δx/Δy, alça, resize | c35c7e140 |
| Rota 2: grade de glifos | fonte vazia convida (Add Latin Basic, digitar, agente); filtro vazio explica | 23483bd9f |

## Rotas e jornadas (ordem)

| # | Rota / superfície | Jornada que ela serve | Foco |
|---|---|---|---|
| 1 | `/launcher` | abrir ou criar fonte | primeira impressão, recentes, estado vazio, arrastar arquivo |
| 2 | `/home` (grade de glifos) | achar, criar e organizar glifos | grade, filtros, busca, criação por Unicode/charset, seleção múltipla |
| 3 | `/editor/:glyph`: canvas | desenhar e lapidar | ferramentas, toolbar flutuante, hover e seleção, menus de contexto, zoom |
| 4 | `/editor`: barra direita | métricas, kerning, exportação | seções, densidade, hierarquia, campos, estados vazios |
| 5 | `/editor`: barra esquerda | camadas, páginas, eixos, masters | árvore, eixos, sources, instâncias |
| 6 | Texto e prova (`text`, `spacing`, `kerning`) | espaçar e kernar em contexto | modo de texto, pares, prévias |
| 7 | Settings (fonte, eixos, masters, instâncias, aparência, agentes) | configurar a família | formulários, grafo de mapping, mensagens de erro |
| 8 | Exportação (popover, opções por linha) | entregar a fonte | plano de arquivos, progresso, erros acionáveis |
| 9 | Agente | pedir, ver e desfazer o trabalho do agente | composer, cards de ação, estados, persistência |
| 10 | Chrome geral | navegar | titlebar, abas, menus, atalhos, tema claro e escuro, foco visível |

Cada linha termina com: print antes e depois, achados do `visant-killer` resolvidos e commit.

## Passada "designer, não tipógrafo" (24/11/2026)

> Pedido do dono: "não é amigável e óbvio pro user que é designer e não tipógrafo. Quero testar em
> tempo real a fonte, mandar editar pontos do vetor, sources com nome amigável, UI/UX burilada end to
> end pra um user de Figma". Direção escolhida: **A + B** (faixa de teste na grade + modo de teste).

Usuário-alvo: designer que vem do Figma. Pensa em "estilos" (Regular, Bold, Itálico), não em masters;
espera digitar uma frase e arrastar o peso; espera selecionar e pedir.

| # | Entrega | Reuso (não reinventar) | Status |
|---|---|---|---|
| 1 | **Sources com nome amigável**: "Regular Italic · Ink Traps" no lugar de `master.Regular.italic.inkt`; nome técnico vai para o tooltip | labels de eixo (STAT) na localização de **usuário** (`font.externalLocationForSource`); senão tabela de peso do OS/2, slant ≠ 0 = Italic, outro eixo fora do default = nome do eixo. Dívida: espelha a tabela do `shift-cli`, mover para `shift-wasm` | feito, fcd0e6100 |
| 2 | **Features com nome humano primeiro**: "Standard Ligatures" grande, `liga` pequeno | lista existente do `FeaturesSection` | feito, d05f2c89d |
| 3 | **B: modo de teste** = Pages existentes renomeadas: "+ New page" vira "Test text", página nasce com frase de amostra | `editor.pages` + text runs (shaping real, já existem). Feito sem frase de amostra: abre na ferramenta Texto | feito, 9f87bff13 |
| 4 | **A: faixa de teste na grade**: uma linha editável acima da grade, renderizada com a fonte atual na localização dos eixos | `previewGlyph`/`fillGlyph` + `kerningRun` da prévia de grupos de kerning; sem shaping (a página de texto faz) | feito, 8042844b5 |
| 5 | **Editar pontos pelo agente**: seleção atual vira chip de contexto no composer ("3 pontos em /a") | `shift.edits.apply` já existe; campo `focus` no pedido vai só pro agente | feito, e9c748237 |
| 1b | **Controles de tipo do Figma**: seletor Style (instâncias nomeadas) + sliders de eixo no painel Text e numa seção Style; duplo clique por níveis (Texto digita, Seleção edita vetor, vazio sai); pan no botão do meio | `Instances.tsx` (aplicar instância), `AxesPanel`, `TypingBehavior`, pan da Mão | feito, 7fd9e390a |
| 6 | Eixos com nome claro e dica do que fazem ("Slant" → tooltip, valor com unidade) | `AxesPanel` | descartado: com o seletor Style os nomes bastam; pôr o label no valor quebraria a digitação |

Ordem: 1 → 2 → 3 → 4 → 5 → 6. Cada item: print antes/depois via CDP (porta 9333), teste de
comportamento quando há lógica, `visant-killer` no fim, commit na `rea`.

Pendências da revisão final, resolvidas:
- Página de texto: digitar além da borda move a vista para manter o cursor visível (9b2e55686, teste fc668ed55).
- Slider de Slant (-10…0) preenche a partir do zero, vazio no default (9b2e55686).
- Na grade, o chip do agente mostra os glifos selecionados na grade; sem seleção, some (commit seguinte ao fc668ed55).

Segunda rodada (24/11, pedido "até ficar 100% burilado" + print do componente Glyph):
- Seção Glyph redesenhada: a letra real entre linhas tracejadas no avanço, campos Left / Right / Width / Name / Unicode, frase no lugar de campos vazios (1e7ab2842).
- Tamanho da fonte na seção Style, fora da ferramenta Texto (1e7ab2842).
- Tabela de pesos única no Rust (`shift_font::weight_class`), exportada pelo `shift-wasm` (0fcf9ae56). Dívida quitada.
- Testes `preview-font` verdes no Windows: limpeza tolera o SQLite ainda aberto (6e6ef2cb3). Suíte de comportamento: 784/784.
- Cabeçalho da barra direita diz "Glyphs" na grade (fcd59827d).
- Kerning fácil: a seção Kerning lista os pares da letra aberta com as vizinhas ("Vi −10"), número arrastável, sem abrir o Kerning tool; entre masters explica como destravar (260d6de61).
- Sources e Instances com uma linha que diz o que cada uma é: desenhos que você edita × estilos que a fonte entrega, misturados dos sources (commit "feat(designspace)").
- Dica ao passar o mouse em cada eixo (o que muda, faixa, duplo clique reseta); teste do kerning de vizinhos pela superfície de teste (b6171ae3b).
- Clippy zerado nos crates: stubs de Windows com `expect(unnecessary_wraps)` e dois avisos herdados do upstream (047551788, 3b07d02ac).

Estado: todos os itens pedidos feitos e verificados na tela; 787/787 testes de comportamento. **Concluída: o dono confirmou que está 100% (24/11/2026).**
