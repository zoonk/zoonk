const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. OUTCOME TIER STRUCTURE: Must have 4 outcome tiers with minStrongChoices forming a descending progression proportional to the total number of steps. One tier must have minStrongChoices: 0 as the catch-all. Tiers must not overlap or skip reasonable thresholds.

2. OUTCOME NARRATIVES: Each narrative must be written in second person and stay within 40 words. Narratives describe where the player ended up at each performance tier — they are hypothetical end states, not replays of specific choices. A narrative like "Your factory runs lean and every part has a destination" is good. Do NOT require narratives to name specific choices — the AI doesn't know which choices the player made.

3. OUTCOME TITLES: Titles must be evocative but not judgmental. Max 5 words. No "Failure", "Perfect", "F grade", or grade-like labels. Confident titles like "Dominio total" or "Master Manager" are fine — they celebrate achievement, not judge. Only penalize labels that shame or grade the player.

4. DEBRIEF CONCEPT QUALITY: Each concept must be a genuine educational insight from the topic — not a restatement of what happened in the story. Concepts should name actual domain knowledge that was hidden during play.

5. CONCEPT-TO-CHOICE CONNECTION: Explanations must reference specific choices or consequences from the story ("When you chose to X, you experienced Y — this is called Z"). Generic explanations that could apply to any story should be penalized.

6. CONCEPT NAMES: Must be actual domain concepts from the topic (this is the reveal moment). Max 5 words. These are the terms the player never saw during the story.

7. COMPLETENESS: The debrief should cover the main educational themes embedded in the story's alignment tags. If the story tested 3 distinct concepts through its choices, the debrief should surface all 3.

8. TONE: Warm, mentoring, not condescending. Like a coach explaining after a game. The player just lived through this — respect their experience. No "you should have" or "the correct answer was."

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for the exact number of concepts — 3-5 is guidance, 6 is fine too
- Do NOT penalize for creative or unconventional concept names if they are accurate
- Do NOT require specific wording patterns in explanations
- Do NOT penalize for outcome tiers that use slightly different thresholds than a mathematical formula would suggest, as long as the progression is logical and descending
- Do NOT penalize outcome narratives for being general — they describe hypothetical end states for performance tiers, not specific choice replays
- Do NOT penalize titles that celebrate achievement (e.g., "Dominio total", "Master Manager") — only penalize labels that shame or use letter/number grades
- Do NOT require perfectly even spacing between tier thresholds — 5/4/2/0 is fine for 5 steps
- ONLY penalize for: missing catch-all tier, language that shames the player, concept explanations that don't connect to ANY part of the story, factually incorrect concept names, or clearly exceeding length constraints (a few words over is fine)
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-kanban-origins",
    userInput: {
      concepts: [
        "Sistema puxado",
        "Estoque mínimo",
        "Fluxo contínuo",
        "Sinalização visual",
        "Produção just-in-time",
      ],
      language: "pt",
      storySteps: {
        intro:
          "Japão, 1950. Chão de fábrica barulhento, cheiro de óleo e aço quente. Recursos escassos, galpão abarrotado de peças sem destino. Você foi promovido ontem.",
        metrics: ["Controle de Estoque", "Caixa", "Entregas no Prazo"],
        steps: [
          {
            choices: [
              {
                alignment: "weak" as const,
                consequence:
                  "O estoque cresce. O aço acaba antes do fim do mês. Dois pedidos urgentes ficam sem matéria-prima. O diretor bate na sua porta.",
                id: "1a",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "negative" as const, metric: "Controle de Estoque" },
                ],
                text: "Produzir mais peças para aproveitar as máquinas paradas",
              },
              {
                alignment: "strong" as const,
                consequence:
                  "Máquinas ficam ociosas por horas. Alguns operários reclamam. Mas o aço dura, e cada peça produzida já tem destino certo.",
                id: "1b",
                metricEffects: [
                  { effect: "positive" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                  { effect: "positive" as const, metric: "Controle de Estoque" },
                ],
                text: "Reduzir a produção e só fabricar o que já foi pedido",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Algumas linhas param com peças quase prontas. Outras que tinham pedidos urgentes ficam lentas. O resultado é desigual.",
                id: "1c",
                metricEffects: [
                  { effect: "negative" as const, metric: "Entregas no Prazo" },
                  { effect: "positive" as const, metric: "Controle de Estoque" },
                ],
                text: "Cortar a produção pela metade em todas as linhas igualmente",
              },
            ],
            situation:
              "Você é gerente de produção numa fábrica de autopeças em 1950. O Japão pós-guerra tem aço escasso e dinheiro curto. Seu galpão está lotado de peças que ninguém encomendou ainda.",
          },
          {
            choices: [
              {
                alignment: "partial" as const,
                consequence:
                  "Gasto enorme de energia e tempo. As bielas viram sucata cara. Você entrega os eixos, mas o custo come todo o lucro.",
                id: "2a",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                  { effect: "negative" as const, metric: "Controle de Estoque" },
                ],
                text: "Derreter as bielas encalhadas e refundir como eixos",
              },
              {
                alignment: "strong" as const,
                consequence:
                  "O cliente aceita três dias a mais. Você produz exatamente o que ele pediu, sem desperdício. Ele elogia a transparência.",
                id: "2b",
                metricEffects: [
                  { effect: "positive" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                  { effect: "positive" as const, metric: "Controle de Estoque" },
                ],
                text: "Negociar prazo maior e começar os eixos quando o aço chegar",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "Os eixos ficam prontos a tempo. Mas a conta estoura o orçamento do mês. O financeiro congela suas próximas compras.",
                id: "2c",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                ],
                text: "Comprar aço de emergência no mercado paralelo, preço triplo",
              },
            ],
            situation:
              "Um cliente importante liga pedindo 200 eixos para a semana que vem. Você tem 800 bielas encalhadas no estoque, mas nenhum eixo pronto. O fornecedor de aço só entrega daqui a cinco dias.",
          },
          {
            choices: [
              {
                alignment: "strong" as const,
                consequence:
                  "Um estalo. Se cada estação da fábrica pedisse peças só quando precisasse, o estoque ficaria no mínimo. Você rabisca num guardanapo.",
                id: "3a",
                metricEffects: [
                  { effect: "positive" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                  { effect: "positive" as const, metric: "Controle de Estoque" },
                ],
                text: "Pensar: 'Ela só repõe o que saiu — a demanda puxa a reposição'",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "Você volta pra casa sem ligar os pontos. Na segunda, o estoque continua crescendo e o galpão apertando.",
                id: "3b",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "negative" as const, metric: "Controle de Estoque" },
                ],
                text: "Pensar: 'O supermercado tem sorte de vender tudo rápido'",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Você descarta a ideia pela metade. Algo incomoda, mas você não desenvolve. Na fábrica, nada muda por enquanto.",
                id: "3c",
                metricEffects: [{ effect: "negative" as const, metric: "Entregas no Prazo" }],
                text: "Pensar: 'Funciona pra arroz, mas peças industriais são diferentes'",
              },
            ],
            situation:
              "Sábado. Você entra num supermercado e para diante da prateleira de arroz. Uma funcionária repõe só os pacotes que os clientes levaram. A prateleira nunca transborda nem esvazia.",
          },
          {
            choices: [
              {
                alignment: "strong" as const,
                consequence:
                  "Os operários começam a pedir só o que precisam, quando precisam. O almoxarifado vira um mini-supermercado. As paradas caem pela metade.",
                id: "4a",
                metricEffects: [
                  { effect: "positive" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                  { effect: "positive" as const, metric: "Controle de Estoque" },
                ],
                text: "Criar um cartão que cada estação envia quando precisa de peças",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "As paradas param, mas agora cada estação tem caixas enormes de pinos. Espaço some. Alguns pinos enferrujam antes do uso.",
                id: "4b",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                  { effect: "negative" as const, metric: "Controle de Estoque" },
                ],
                text: "Montar um estoque grande de pinos em cada estação",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Melhora, mas às vezes ele leva demais, às vezes de menos. A sincronia depende da memória de uma pessoa.",
                id: "4c",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                ],
                text: "Designar um funcionário para levar pinos de hora em hora",
              },
            ],
            situation:
              "Segunda-feira. Três estações de montagem param ao mesmo tempo — faltam pinos que estão sobrando no almoxarifado do outro lado do galpão. Ninguém sabia que havia estoque lá.",
          },
          {
            choices: [
              {
                alignment: "strong" as const,
                consequence:
                  "Ele examina os relatórios. O silêncio dura um minuto. 'Continuem assim.' Ele aperta sua mão. Os operários respiram aliviados.",
                id: "5a",
                metricEffects: [
                  { effect: "positive" as const, metric: "Caixa" },
                  { effect: "positive" as const, metric: "Entregas no Prazo" },
                  { effect: "positive" as const, metric: "Controle de Estoque" },
                ],
                text: "Mostrar os números: menos estoque, mais entregas no prazo, custo menor",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "O galpão ronca. Peças se acumulam sem pedido. Em duas semanas, o estoque volta ao caos do início. O diretor volta, pior.",
                id: "5b",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "negative" as const, metric: "Entregas no Prazo" },
                  { effect: "negative" as const, metric: "Controle de Estoque" },
                ],
                text: "Ligar todas as máquinas imediatamente para impressionar",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Ele vai embora satisfeito, por ora. Você ganha tempo, mas a pressão volta. Alguns operários começam a produzir peças desnecessárias por medo.",
                id: "5c",
                metricEffects: [
                  { effect: "negative" as const, metric: "Caixa" },
                  { effect: "negative" as const, metric: "Controle de Estoque" },
                ],
                text: "Prometer aumentar a produção gradualmente nos próximos dias",
              },
            ],
            situation:
              "O diretor-geral visita a fábrica. A produção está enxuta, mas ele vê máquinas paradas e fica furioso. 'Por que não estamos produzindo no máximo?', ele grita no chão de fábrica.",
          },
        ],
      },
      topic: "Origens do Kanban",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-web-packets-network-paths",
    userInput: {
      concepts: ["Packet switching", "Routing", "Latency", "Bandwidth", "Network congestion"],
      language: "en",
      storySteps: {
        intro:
          "You’re the overnight tech on a busy studio lot. A live stream keeps freezing, phones are lighting up, and the control room wants answers now.",
        metrics: ["Signal", "Time", "Trust"],
        steps: [
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "You trace one frozen clip from camera to control room, noting each stop. One bad relay keeps showing up, and the room gets quiet as the pattern clicks.",
                id: "s1_c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Signal",
                  },
                  {
                    effect: "neutral",
                    metric: "Time",
                  },
                  {
                    effect: "positive",
                    metric: "Trust",
                  },
                ],
                text: "Follow one clip stop by stop",
              },
              {
                alignment: "partial",
                consequence:
                  "You restart the control room screens. A few feeds return for a minute, but the stutter crawls back and people start hovering over your shoulder.",
                id: "s1_c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Signal",
                  },
                  {
                    effect: "negative",
                    metric: "Time",
                  },
                  {
                    effect: "neutral",
                    metric: "Trust",
                  },
                ],
                text: "Restart the control room gear",
              },
              {
                alignment: "weak",
                consequence:
                  "You tell every camera team to lower quality at once. The picture gets uglier, complaints get louder, and the freezes still hit random moments.",
                id: "s1_c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Signal",
                  },
                  {
                    effect: "negative",
                    metric: "Trust",
                  },
                ],
                text: "Lower quality on every camera",
              },
            ],
            situation:
              "One camera feed freezes again, then snaps back. You need a fast way to figure out where the trouble starts before the director loses patience.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "You compare what leaves the camera with what reaches the next room. The labels match until one handoff, where pieces arrive out of order and late.",
                id: "s2_c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Signal",
                  },
                  {
                    effect: "positive",
                    metric: "Trust",
                  },
                ],
                text: "Compare what enters and leaves each handoff",
              },
              {
                alignment: "partial",
                consequence:
                  "You swap one cable that looks worn. That line improves, but two other feeds still stumble, and the producer asks why the problem keeps moving.",
                id: "s2_c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Signal",
                  },
                  {
                    effect: "negative",
                    metric: "Time",
                  },
                ],
                text: "Replace the worst-looking cable first",
              },
              {
                alignment: "weak",
                consequence:
                  "You blame the camera operator and ask for a full reboot there. The operator loses a shot, tempers flare, and the control room still sees dropouts.",
                id: "s2_c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Trust",
                  },
                  {
                    effect: "negative",
                    metric: "Time",
                  },
                ],
                text: "Reboot the camera causing complaints",
              },
            ],
            situation:
              "A floor runner says the bad feed looked fine in the hallway monitor. That means the problem may appear only after the signal passes through another room.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "You send a tiny test burst out and back along the same route. One return takes far longer than the others, and suddenly the weak spot has a name.",
                id: "s3_c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Signal",
                  },
                  {
                    effect: "positive",
                    metric: "Time",
                  },
                  {
                    effect: "positive",
                    metric: "Trust",
                  },
                ],
                text: "Send a small test out and back",
              },
              {
                alignment: "partial",
                consequence:
                  "You watch the meters longer, hoping a pattern appears. You do spot a delay, but precious minutes drain away while the director drums fingers on glass.",
                id: "s3_c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Signal",
                  },
                  {
                    effect: "negative",
                    metric: "Time",
                  },
                ],
                text: "Keep watching the live meters",
              },
              {
                alignment: "weak",
                consequence:
                  "You reroute every feed through a spare path immediately. The spare path chokes under the load, and now more screens hiccup at once.",
                id: "s3_c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Signal",
                  },
                  {
                    effect: "negative",
                    metric: "Trust",
                  },
                  {
                    effect: "negative",
                    metric: "Time",
                  },
                ],
                text: "Move all feeds to the spare path",
              },
            ],
            situation:
              "A surprise rehearsal starts early, doubling traffic through the building. At the same time, a quick test return arrives much slower than the outgoing signal.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "You isolate the relay that mishandles labeled pieces meant for one room. Other feeds steady almost immediately, and the producer finally stops shouting your name.",
                id: "s4_c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Signal",
                  },
                  {
                    effect: "positive",
                    metric: "Trust",
                  },
                ],
                text: "Bypass the relay sending pieces wrong",
              },
              {
                alignment: "partial",
                consequence:
                  "You split traffic between two routes by guesswork. Some screens smooth out, but one key camera still freezes during close-ups.",
                id: "s4_c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Signal",
                  },
                  {
                    effect: "neutral",
                    metric: "Trust",
                  },
                  {
                    effect: "negative",
                    metric: "Time",
                  },
                ],
                text: "Divide traffic across two routes",
              },
              {
                alignment: "weak",
                consequence:
                  "You boost every sender to push harder. Fans whine, the rooms heat up, and the jammed relay keeps dropping the same chunks.",
                id: "s4_c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Signal",
                  },
                  {
                    effect: "negative",
                    metric: "Time",
                  },
                ],
                text: "Crank up every sender",
              },
            ],
            situation:
              "The station manager walks in with a sponsor beside her. One relay cabinet is blinking wildly, and the biggest screen freezes right as they look up.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "You show the route map, the delayed return, and the bad relay’s mismatch. The sponsor sees the stream recover live, and the room breaks into relieved applause.",
                id: "s5_c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Signal",
                  },
                  {
                    effect: "positive",
                    metric: "Trust",
                  },
                  {
                    effect: "positive",
                    metric: "Time",
                  },
                ],
                text: "Present the route and swap the bad relay",
              },
              {
                alignment: "partial",
                consequence:
                  "You keep the workaround running and promise a deeper fix later. The show survives, but everyone knows the setup is still fragile.",
                id: "s5_c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Signal",
                  },
                  {
                    effect: "positive",
                    metric: "Time",
                  },
                  {
                    effect: "neutral",
                    metric: "Trust",
                  },
                ],
                text: "Keep the workaround through the show",
              },
              {
                alignment: "weak",
                consequence:
                  "You insist the issue is basically gone and do nothing else. Minutes later, the freeze returns during the sponsor mention, and every face in the room sours.",
                id: "s5_c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Signal",
                  },
                  {
                    effect: "negative",
                    metric: "Trust",
                  },
                ],
                text: "Declare victory and leave it alone",
              },
            ],
            situation:
              "The show opens in two minutes. You have one shot to either lock in the fix or gamble that the stream holds under the heaviest load of the night.",
          },
        ],
      },
      topic: "Packets and Network Paths",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-tipos-numericos-principais",
    userInput: {
      concepts: [
        "Inteiros",
        "Ponto flutuante",
        "Booleanos",
        "Números complexos",
        "Conversão de tipos",
      ],
      language: "pt",
      storySteps: {
        intro:
          "Você está corrigindo um placar automático minutos antes da feira abrir. Os números na tela piscam estranho, e a fila já começa a reclamar.",
        metrics: ["Clareza do placar", "Confiança da equipe", "Ritmo da abertura"],
        steps: [
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "Você separa contagens, medidas, sinais de ligado e campos vazios. O placar para de misturar tudo, e a equipe respira mais aliviada.",
                id: "s1c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "positive",
                    metric: "Confiança da equipe",
                  },
                ],
                text: "Separar contagens, medidas, sinais e campos vazios",
              },
              {
                alignment: "partial",
                consequence:
                  "Você troca alguns valores visivelmente errados. A tela melhora um pouco, mas logo outro canto volta a piscar.",
                id: "s1c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "neutral",
                    metric: "Ritmo da abertura",
                  },
                ],
                text: "Corrigir só os valores que piscam",
              },
              {
                alignment: "weak",
                consequence:
                  "Você força tudo para o mesmo formato. O total de ingressos vira quebrado, e um campo vazio aparece como número estranho.",
                id: "s1c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "negative",
                    metric: "Confiança da equipe",
                  },
                ],
                text: "Colocar todos os valores no mesmo formato",
              },
            ],
            situation:
              "Você abre o painel. Há contagem de pessoas, temperatura do salão, luzes ligadas ou não e espaços ainda sem valor. Tudo aparece junto no placar.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "Você guarda o resultado novo em outro lugar e atualiza a tela. O valor muda sem bagunçar o restante, e o operador sorri de canto.",
                id: "s2c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "positive",
                    metric: "Ritmo da abertura",
                  },
                ],
                text: "Calcular de novo e substituir o valor mostrado",
              },
              {
                alignment: "partial",
                consequence:
                  "Você refaz a conta inteira manualmente. Funciona agora, mas leva tempo e trava quem espera a próxima atualização.",
                id: "s2c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "negative",
                    metric: "Ritmo da abertura",
                  },
                ],
                text: "Refazer toda a conta do zero",
              },
              {
                alignment: "weak",
                consequence:
                  "Você tenta esticar o valor atual como se ele mudasse por dentro. Nada acompanha, e a tela antiga continua presa.",
                id: "s2c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "negative",
                    metric: "Confiança da equipe",
                  },
                ],
                text: "Mexer no valor atual sem trocar ele",
              },
            ],
            situation:
              "A catraca envia mais 25 entradas. O auxiliar diz para você só mexer no número que já está na tela, sem recalcular nada.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "Você mantém o sinal de ligado separado das contagens e deixa o espaço vazio realmente vazio. O painel volta estável, e a chefe para de apertar o rádio.",
                id: "s3c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "positive",
                    metric: "Confiança da equipe",
                  },
                  {
                    effect: "positive",
                    metric: "Ritmo da abertura",
                  },
                ],
                text: "Tratar ligado e vazio como coisas diferentes",
              },
              {
                alignment: "partial",
                consequence:
                  "Você troca o vazio por zero para a tela não travar. O painel anda, mas um setor parece aberto sem ninguém lá.",
                id: "s3c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Ritmo da abertura",
                  },
                  {
                    effect: "negative",
                    metric: "Clareza do placar",
                  },
                ],
                text: "Trocar o vazio por zero temporariamente",
              },
              {
                alignment: "weak",
                consequence:
                  "Você soma o sinal de ligado com a contagem e tenta preencher o vazio do mesmo jeito. Um portão fechado ganha público do nada.",
                id: "s3c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "negative",
                    metric: "Confiança da equipe",
                  },
                ],
                text: "Misturar ligado, contagem e vazio na mesma conta",
              },
            ],
            situation:
              "De repente, um portão some do mapa. O sensor manda apenas ligado ou desligado, enquanto outro setor ainda nem enviou valor algum.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "Você mantém a medida com casas quando precisa e a contagem inteira onde deve. O aviso de lotação bate certo, e ninguém discute na entrada.",
                id: "s4c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "positive",
                    metric: "Ritmo da abertura",
                  },
                ],
                text: "Usar medida quebrada e contagem inteira separadas",
              },
              {
                alignment: "partial",
                consequence:
                  "Você arredonda tudo para acelerar. A tela fica limpa, mas a lotação oscila na beira do limite e gera dúvida.",
                id: "s4c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Ritmo da abertura",
                  },
                  {
                    effect: "negative",
                    metric: "Clareza do placar",
                  },
                ],
                text: "Arredondar tudo para números inteiros",
              },
              {
                alignment: "weak",
                consequence:
                  "Você transforma a contagem em medida quebrada e reaproveita igual para tudo. Surgem pessoas fracionadas no painel, e a equipe ri de nervoso.",
                id: "s4c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "negative",
                    metric: "Confiança da equipe",
                  },
                ],
                text: "Tratar pessoas e medidas do mesmo jeito",
              },
            ],
            situation:
              "A feira lota mais rápido que o previsto. Agora o sistema cruza número de pessoas com uma média de fluxo por minuto para liberar avisos.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "Você isola aquele cálculo esquisito, mantém o resto nos trilhos e evita usar vazio como número. O painel fecha a abertura sem sustos.",
                id: "s5c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "positive",
                    metric: "Confiança da equipe",
                  },
                  {
                    effect: "positive",
                    metric: "Ritmo da abertura",
                  },
                ],
                text: "Isolar o cálculo esquisito e proteger os vazios",
              },
              {
                alignment: "partial",
                consequence:
                  "Você desliga só a parte problemática e segue com o básico. A abertura acontece, mas metade dos avisos some e o chefe faz cara feia.",
                id: "s5c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Ritmo da abertura",
                  },
                  {
                    effect: "negative",
                    metric: "Confiança da equipe",
                  },
                ],
                text: "Desligar a parte estranha e seguir com o resto",
              },
              {
                alignment: "weak",
                consequence:
                  "Você tenta enfiar o resultado esquisito e os campos vazios no placar principal. A tela congela de vez, e a fila começa a vaiar.",
                id: "s5c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Clareza do placar",
                  },
                  {
                    effect: "negative",
                    metric: "Confiança da equipe",
                  },
                  {
                    effect: "negative",
                    metric: "Ritmo da abertura",
                  },
                ],
                text: "Juntar tudo no placar principal de uma vez",
              },
            ],
            situation:
              "No último teste, aparece um resultado com parte comum e parte imaginária vindo de um módulo antigo. Ao mesmo tempo, há setores ainda sem dado.",
          },
        ],
      },
      topic: "Tipos numéricos principais",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-formacion-enoles-enolatos",
    userInput: {
      concepts: [
        "Tautomería ceto-enólica",
        "Acidez del hidrógeno alfa",
        "Enolización",
        "Bases fuertes y débiles",
        "Alquilación de enolatos",
      ],
      language: "es",
      storySteps: {
        intro:
          "Estás en la mesa del laboratorio y el matraz ya cambió de color. Tu jefa quiere el siguiente paso ahora, antes de que la mezcla se arruine.",
        metrics: ["Pureza", "Velocidad", "Control"],
        steps: [
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "La mezcla se aclara poco a poco y aparece una nueva señal limpia. Tu jefa asiente: va lento, pero todo sigue bajo control.",
                id: "s1c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Pureza",
                  },
                  {
                    effect: "neutral",
                    metric: "Velocidad",
                  },
                  {
                    effect: "positive",
                    metric: "Control",
                  },
                ],
                text: "Añade unas gotas ácidas y espera",
              },
              {
                alignment: "weak",
                consequence:
                  "El matraz se calienta de golpe y salen manchas en la placa. Un compañero frunce el ceño al ver tantas señales nuevas.",
                id: "s1c2",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Pureza",
                  },
                  {
                    effect: "positive",
                    metric: "Velocidad",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                ],
                text: "Echa base fuerte de una vez",
              },
              {
                alignment: "partial",
                consequence:
                  "La mezcla casi no cambia y el reloj corre. Ganas tiempo de observación, pero el avance es desesperadamente corto.",
                id: "s1c3",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Pureza",
                  },
                  {
                    effect: "negative",
                    metric: "Velocidad",
                  },
                  {
                    effect: "neutral",
                    metric: "Control",
                  },
                ],
                text: "Calienta suave sin añadir nada",
              },
            ],
            situation:
              "Tienes un carbonilo en disolvente y apenas empieza a moverse. La pantalla del equipo muestra conversión baja y todos te miran.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "La mezcla responde enseguida y mantiene un aspecto uniforme. La toma de muestra sale consistente y fácil de repetir.",
                id: "s2c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Velocidad",
                  },
                  {
                    effect: "positive",
                    metric: "Control",
                  },
                ],
                text: "Usa base de litio en frío",
              },
              {
                alignment: "partial",
                consequence:
                  "Sí reacciona, pero la muestra sale más revuelta de lo esperado. Avanza, aunque con bordes menos nítidos.",
                id: "s2c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Velocidad",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                  {
                    effect: "neutral",
                    metric: "Pureza",
                  },
                ],
                text: "Usa base de sodio a temperatura ambiente",
              },
              {
                alignment: "weak",
                consequence:
                  "La mezcla se queda perezosa y luego aparecen productos raros. Tu jefa te pide repetir la corrida desde cero.",
                id: "s2c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Pureza",
                  },
                  {
                    effect: "negative",
                    metric: "Velocidad",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                ],
                text: "Dilúyelo más y espera",
              },
            ],
            situation:
              "Ahora necesitas quitar ese hidrógeno vecino antes de que llegue el reactivo siguiente. El baño frío está listo y solo hay una oportunidad limpia.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "La nueva adición entra pareja y el perfil mejora justo cuando parecía perderse. El técnico levanta el pulgar desde la campana.",
                id: "s3c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Pureza",
                  },
                  {
                    effect: "positive",
                    metric: "Control",
                  },
                ],
                text: "Mantén frío y añade el atrapador enseguida",
              },
              {
                alignment: "partial",
                consequence:
                  "Obtienes algo del producto buscado, pero la mezcla cambia mientras esperas. Cuando revisas, ya no todo está donde lo dejaste.",
                id: "s3c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Pureza",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                  {
                    effect: "neutral",
                    metric: "Velocidad",
                  },
                ],
                text: "Déjalo reposar y luego añade el reactivo",
              },
              {
                alignment: "weak",
                consequence:
                  "Al templarse, la mezcla se reorganiza y la señal buena cae. Sientes ese silencio feo de cuando todos saben que algo se fue.",
                id: "s3c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Pureza",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                ],
                text: "Sácalo del frío para acelerar todo",
              },
            ],
            situation:
              "De pronto se retrasa el reactivo siguiente. La mezcla activa sigue en el matraz y cada minuto cambia lo que tienes en las manos.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "La mezcla se apaga con calma y la muestra final sale ordenada. Tu jefa sonríe: esta sí se puede aislar.",
                id: "s4c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Pureza",
                  },
                  {
                    effect: "positive",
                    metric: "Control",
                  },
                  {
                    effect: "neutral",
                    metric: "Velocidad",
                  },
                ],
                text: "Apaga con una fuente suave y medida",
              },
              {
                alignment: "partial",
                consequence:
                  "Logras frenar la reacción, pero el matraz da un pequeño sobresalto. Se salva material, aunque queda trabajo extra de limpieza.",
                id: "s4c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Pureza",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                  {
                    effect: "neutral",
                    metric: "Velocidad",
                  },
                ],
                text: "Añade agua rápido y agita",
              },
              {
                alignment: "weak",
                consequence:
                  "La mezcla hierve localmente y aparecen más manchas. Un asistente retrocede mientras tú intentas domar el matraz.",
                id: "s4c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Pureza",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                  {
                    effect: "negative",
                    metric: "Velocidad",
                  },
                ],
                text: "Echa ácido concentrado de golpe",
              },
            ],
            situation:
              "El reactivo por fin llegó, pero primero debes detener la mezcla sin arruinar lo ya ganado. El matraz sigue sensible y caliente al tacto.",
          },
          {
            choices: [
              {
                alignment: "strong",
                consequence:
                  "La corrida final da un perfil limpio y repetible. Tu jefa toma la libreta y dice que ya tienen condiciones confiables.",
                id: "s5c1",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Pureza",
                  },
                  {
                    effect: "positive",
                    metric: "Velocidad",
                  },
                  {
                    effect: "positive",
                    metric: "Control",
                  },
                ],
                text: "Repite en frío con el mismo metal y tiempos cortos",
              },
              {
                alignment: "partial",
                consequence:
                  "Consigues material usable, pero cada repetición cambia un poco. Sirve para mostrar avance, no para dormir tranquilo.",
                id: "s5c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Pureza",
                  },
                  {
                    effect: "neutral",
                    metric: "Velocidad",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                ],
                text: "Escala ya con condiciones parecidas",
              },
              {
                alignment: "weak",
                consequence:
                  "En grande, la mezcla se vuelve caprichosa y se ensucia rápido. Lo que parecía funcionar en pequeño se te desarma enfrente.",
                id: "s5c3",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Pureza",
                  },
                  {
                    effect: "negative",
                    metric: "Velocidad",
                  },
                  {
                    effect: "negative",
                    metric: "Control",
                  },
                ],
                text: "Cambia de metal y sube la temperatura",
              },
            ],
            situation:
              "Te piden decidir las condiciones para la corrida grande ahora mismo. Si eliges mal, se va el día entero y también la paciencia del equipo.",
          },
        ],
      },
      topic: "Formación de enoles y enolatos",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-economics-sectoral-comovements",
    userInput: {
      concepts: [
        "Business cycle synchronization",
        "Sectoral spillovers",
        "Regional disparities",
        "Leading and lagging indicators",
        "Aggregate demand shocks",
      ],
      language: "en",
      storySteps: {
        intro:
          "You’re covering the state economy desk when screens flash red. Factory orders wobble, cranes go still, and the governor wants a live briefing in an hour.",
        metrics: ["Output", "Jobs", "Credibility"],
        steps: [
          {
            choices: [
              {
                alignment: "weak",
                consequence:
                  "You lead with the factory slump as the whole story. Reporters repeat it, but hotel and clinic owners call in furious, saying your picture misses what they see.",
                id: "s1c1",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Credibility",
                  },
                  {
                    effect: "negative",
                    metric: "Output",
                  },
                ],
                text: "Frame everything around factories",
              },
              {
                alignment: "strong",
                consequence:
                  "You compare factories, building sites, stores, and clinics before speaking. The first chart looks messier, but your briefing sounds grounded and the room leans in.",
                id: "s1c2",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Credibility",
                  },
                  {
                    effect: "neutral",
                    metric: "Output",
                  },
                ],
                text: "Check several kinds of businesses first",
              },
              {
                alignment: "partial",
                consequence:
                  "You split the difference and mention factories plus retail. It lands better than a single-story pitch, but big gaps still sit in your blind spot.",
                id: "s1c3",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Credibility",
                  },
                  {
                    effect: "neutral",
                    metric: "Output",
                  },
                ],
                text: "Compare factories with stores only",
              },
            ],
            situation:
              "Phones buzz nonstop as fresh business reports land. You need one opening line for the governor’s briefing, and everyone expects a clean read right now.",
          },
          {
            choices: [
              {
                alignment: "weak",
                consequence:
                  "You average the state into one neat number. It sounds tidy, but mayors from booming and slumping areas both say your map feels fake.",
                id: "s2c1",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Credibility",
                  },
                  {
                    effect: "neutral",
                    metric: "Jobs",
                  },
                ],
                text: "Use one statewide average",
              },
              {
                alignment: "partial",
                consequence:
                  "You highlight the biggest city and one rural county. The contrast helps, but whole stretches of the state still vanish from the story.",
                id: "s2c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Credibility",
                  },
                  {
                    effect: "neutral",
                    metric: "Jobs",
                  },
                ],
                text: "Compare one city and one rural area",
              },
              {
                alignment: "strong",
                consequence:
                  "You line up metro, small-town, and border-area data side by side. Patterns start to echo each other, but the differences finally have shape.",
                id: "s2c3",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Credibility",
                  },
                  {
                    effect: "positive",
                    metric: "Jobs",
                  },
                ],
                text: "Scan several regions side by side",
              },
            ],
            situation:
              "A producer asks why layoffs feel brutal in one county but hardly visible in another. The camera light is warming up, and you need a map that won’t collapse under questions.",
          },
          {
            choices: [
              {
                alignment: "weak",
                consequence:
                  "You call it a statewide collapse and urge alarm. Then software hiring and hospital payrolls show up strong, and your inbox fills with angry corrections.",
                id: "s3c1",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Credibility",
                  },
                  {
                    effect: "negative",
                    metric: "Jobs",
                  },
                ],
                text: "Treat the drop as universal",
              },
              {
                alignment: "strong",
                consequence:
                  "You flag that some lines of work swing hard while others barely bend. Suddenly the surprise makes sense, and your next questions get sharper.",
                id: "s3c2",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Credibility",
                  },
                  {
                    effect: "positive",
                    metric: "Jobs",
                  },
                ],
                text: "Separate sharp-swinging work from steadier work",
              },
              {
                alignment: "partial",
                consequence:
                  "You mention that services look calmer, but stop there. It helps a little, though the construction shock still hangs unexplained.",
                id: "s3c3",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Credibility",
                  },
                  {
                    effect: "neutral",
                    metric: "Jobs",
                  },
                ],
                text: "Note that some service jobs held up",
              },
            ],
            situation:
              "A surprise update hits: building permits plunge before dawn, yet hospital visits and app sales hold steady. The governor’s aide texts, “Why are these moving so differently?”",
          },
          {
            choices: [
              {
                alignment: "weak",
                consequence:
                  "You chase the loudest county and rewrite the whole briefing around it. The story becomes dramatic, then falls apart when other regions don’t match.",
                id: "s4c1",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Credibility",
                  },
                  {
                    effect: "negative",
                    metric: "Output",
                  },
                ],
                text: "Center the outlier region",
              },
              {
                alignment: "partial",
                consequence:
                  "You keep the statewide story but add one warning slide on local gaps. It softens the problem, though the briefing still feels too smooth.",
                id: "s4c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Credibility",
                  },
                  {
                    effect: "neutral",
                    metric: "Output",
                  },
                ],
                text: "Keep the big picture with one caveat",
              },
              {
                alignment: "strong",
                consequence:
                  "You show the shared slowdown first, then the places and industries moving harder or softer. The governor nods; the story finally holds together under pressure.",
                id: "s4c3",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Credibility",
                  },
                  {
                    effect: "positive",
                    metric: "Output",
                  },
                ],
                text: "Show common movement and local gaps together",
              },
            ],
            situation:
              "Ten minutes before air, a coastal county reports booming tourism while inland plants cut shifts again. Staffers argue over which fact should lead the entire briefing.",
          },
          {
            choices: [
              {
                alignment: "weak",
                consequence:
                  "You promise a single number will settle everything. The press conference turns combative, with every reporter citing a different corner you ignored.",
                id: "s5c1",
                metricEffects: [
                  {
                    effect: "negative",
                    metric: "Credibility",
                  },
                  {
                    effect: "negative",
                    metric: "Output",
                  },
                  {
                    effect: "negative",
                    metric: "Jobs",
                  },
                ],
                text: "End with one headline number",
              },
              {
                alignment: "partial",
                consequence:
                  "You present separate pages for each industry and region. The detail is useful, but the governor struggles to answer what ties them together.",
                id: "s5c2",
                metricEffects: [
                  {
                    effect: "neutral",
                    metric: "Credibility",
                  },
                  {
                    effect: "neutral",
                    metric: "Output",
                  },
                  {
                    effect: "neutral",
                    metric: "Jobs",
                  },
                ],
                text: "Give separate pages for every slice",
              },
              {
                alignment: "strong",
                consequence:
                  "You close with one clear thread and show where it hits hardest and where it barely lands. Questions get tougher, but your answers keep holding.",
                id: "s5c3",
                metricEffects: [
                  {
                    effect: "positive",
                    metric: "Credibility",
                  },
                  {
                    effect: "positive",
                    metric: "Output",
                  },
                  {
                    effect: "positive",
                    metric: "Jobs",
                  },
                ],
                text: "Tie the shared pattern to the uneven damage",
              },
            ],
            situation:
              "You’re live. Reporters fire questions about closed plants, stalled housing, busy clinics, and uneven counties all at once, and the governor turns to you for the final frame.",
          },
        ],
      },
      topic: "Sectoral and Regional Comovements",
    },
  },
];
