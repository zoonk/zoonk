const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. OUTCOME TIER STRUCTURE: Must have 4 outcome tiers with minStrongChoices forming a descending progression proportional to the total number of steps. One tier must have minStrongChoices: 0 as the catch-all. Tiers must not overlap or skip reasonable thresholds.

2. OUTCOME NARRATIVES: Each narrative must be written in second person, reference specific moments from the story, and stay within 40 words. Narratives should describe where the player ended up — not lecture about what they should have done.

3. OUTCOME TITLES: Titles must be evocative but not judgmental. Max 5 words. No "Failure", "Perfect", or grade-like labels. Good examples: "The Factory Hums", "Chaos on the Floor."

4. DEBRIEF CONCEPT QUALITY: Each concept must be a genuine educational insight from the topic — not a restatement of what happened in the story. Concepts should name actual domain knowledge that was hidden during play.

5. CONCEPT-TO-CHOICE CONNECTION: Explanations must reference specific choices or consequences from the story ("When you chose to X, you experienced Y — this is called Z"). Generic explanations that could apply to any story should be penalized.

6. CONCEPT NAMES: Must be actual domain concepts from the topic (this is the reveal moment). Max 5 words. These are the terms the player never saw during the story.

7. COMPLETENESS: The debrief should cover the main educational themes embedded in the story's alignment tags. If the story tested 3 distinct concepts through its choices, the debrief should surface all 3.

8. TONE: Warm, mentoring, not condescending. Like a coach explaining after a game. The player just lived through this — respect their experience. No "you should have" or "the correct answer was."

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for the exact number of concepts (3-5 is the range, any count within it is fine)
- Do NOT penalize for creative or unconventional concept names if they are accurate
- Do NOT require specific wording patterns in explanations
- Do NOT penalize for outcome tiers that use slightly different thresholds than a mathematical formula would suggest, as long as the progression is logical
- ONLY penalize for: missing catch-all tier, judgmental/punitive language, generic explanations without story references, factually incorrect concept names, or exceeding length constraints
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-kanban-origins",
    userInput: {
      language: "pt",
      storySteps: {
        intro:
          "Japão, 1950. Chão de fábrica barulhento, cheiro de óleo e aço quente. Recursos escassos, galpão abarrotado de peças sem destino. Você foi promovido ontem.",
        metrics: [
          { id: "estoque", initial: 40, label: "Controle de Estoque" },
          { id: "caixa", initial: 45, label: "Caixa" },
          { id: "entrega", initial: 50, label: "Entregas no Prazo" },
        ],
        steps: [
          {
            choices: [
              {
                alignment: "weak" as const,
                consequence:
                  "O estoque cresce. O aço acaba antes do fim do mês. Dois pedidos urgentes ficam sem matéria-prima. O diretor bate na sua porta.",
                id: "1a",
                metricChanges: { caixa: -15, estoque: -10 },
                text: "Produzir mais peças para aproveitar as máquinas paradas",
              },
              {
                alignment: "strong" as const,
                consequence:
                  "Máquinas ficam ociosas por horas. Alguns operários reclamam. Mas o aço dura, e cada peça produzida já tem destino certo.",
                id: "1b",
                metricChanges: { caixa: 10, entrega: 5, estoque: 10 },
                text: "Reduzir a produção e só fabricar o que já foi pedido",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Algumas linhas param com peças quase prontas. Outras que tinham pedidos urgentes ficam lentas. O resultado é desigual.",
                id: "1c",
                metricChanges: { entrega: -5, estoque: 5 },
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
                metricChanges: { caixa: -15, entrega: 5, estoque: -5 },
                text: "Derreter as bielas encalhadas e refundir como eixos",
              },
              {
                alignment: "strong" as const,
                consequence:
                  "O cliente aceita três dias a mais. Você produz exatamente o que ele pediu, sem desperdício. Ele elogia a transparência.",
                id: "2b",
                metricChanges: { caixa: 10, entrega: 10, estoque: 5 },
                text: "Negociar prazo maior e começar os eixos quando o aço chegar",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "Os eixos ficam prontos a tempo. Mas a conta estoura o orçamento do mês. O financeiro congela suas próximas compras.",
                id: "2c",
                metricChanges: { caixa: -15, entrega: 10 },
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
                metricChanges: { caixa: 5, entrega: 5, estoque: 10 },
                text: "Pensar: 'Ela só repõe o que saiu — a demanda puxa a reposição'",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "Você volta pra casa sem ligar os pontos. Na segunda, o estoque continua crescendo e o galpão apertando.",
                id: "3b",
                metricChanges: { caixa: -5, estoque: -5 },
                text: "Pensar: 'O supermercado tem sorte de vender tudo rápido'",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Você descarta a ideia pela metade. Algo incomoda, mas você não desenvolve. Na fábrica, nada muda por enquanto.",
                id: "3c",
                metricChanges: { entrega: -5 },
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
                metricChanges: { caixa: 5, entrega: 15, estoque: 10 },
                text: "Criar um cartão que cada estação envia quando precisa de peças",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "As paradas param, mas agora cada estação tem caixas enormes de pinos. Espaço some. Alguns pinos enferrujam antes do uso.",
                id: "4b",
                metricChanges: { caixa: -10, entrega: 10, estoque: -10 },
                text: "Montar um estoque grande de pinos em cada estação",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Melhora, mas às vezes ele leva demais, às vezes de menos. A sincronia depende da memória de uma pessoa.",
                id: "4c",
                metricChanges: { caixa: -5, entrega: 5 },
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
                metricChanges: { caixa: 10, entrega: 10, estoque: 5 },
                text: "Mostrar os números: menos estoque, mais entregas no prazo, custo menor",
              },
              {
                alignment: "weak" as const,
                consequence:
                  "O galpão ronca. Peças se acumulam sem pedido. Em duas semanas, o estoque volta ao caos do início. O diretor volta, pior.",
                id: "5b",
                metricChanges: { caixa: -15, entrega: -10, estoque: -15 },
                text: "Ligar todas as máquinas imediatamente para impressionar",
              },
              {
                alignment: "partial" as const,
                consequence:
                  "Ele vai embora satisfeito, por ora. Você ganha tempo, mas a pressão volta. Alguns operários começam a produzir peças desnecessárias por medo.",
                id: "5c",
                metricChanges: { caixa: -5, estoque: -5 },
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
];
