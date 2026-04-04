const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. STATEMENT COUNT: Exactly 3 tiers (best, overclaims, dismissive), each with a text and feedback.

2. QUALITY TIERS: The "best" should acknowledge both what the evidence shows and its limits. "overclaims" should read too much into it. "dismissive" should dismiss relevant evidence.

3. PERSPECTIVE CONSISTENCY: All interpretations must be written from the perspective of someone who believes the given explanation. They should make sense for that specific hunch.

4. MIRRORED STRUCTURE: All 3 statement texts must use the same sentence structure, same opening pattern, and same length. The ONLY difference should be the reasoning inside.

5. PER-TIER FEEDBACK: Each tier's feedback must address the specific choice. overclaims feedback should point out the leap; dismissive feedback should point out what was ignored; best feedback should reinforce what was handled well. All feedback must reference specific evidence details, not generic phrases.

6. LANGUAGE: All content must be in the specified language. Only JSON field names should be in English.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-web-packets-network-paths",
    userInput: {
      explanation:
        "A recent equipment change is sending requests through a much longer chain of machines before they reach the app.",
      finding:
        "A timing breakdown shows the browser connects quickly and the app starts generating the page in its usual time. However, there is a long gap while data is being exchanged after the first response bytes appear, and that gap is much larger only for users in the affected region.",
      language: "en",
      scenario:
        "Your team's web app suddenly feels slow for users in one region, even though the servers look healthy and CPU use is normal. You need to figure out why pages are taking several extra seconds to load before support starts rolling back unrelated changes.",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-inf-nan",
    userInput: {
      explanation:
        "Um dado ausente ou inválido entrou como se fosse número comum, e as contas seguintes espalharam esse problema por vários relatórios.",
      finding:
        "Ao seguir o caminho dos dados, os valores já saem da leitura inicial com diferenças de formato entre colunas parecidas, e em uma etapa intermediária alguns campos passam a aparecer como número comum mesmo quando vieram vazios. No entanto, em outras linhas o valor original continua visível até quase o fim e o problema só aparece no fechamento do relatório.",
      language: "pt",
      scenario:
        "Você foi chamado porque o sistema de risco de uma fintech aprovou alguns pedidos que deveriam ter sido bloqueados e, ao mesmo tempo, marcou outros como impossíveis de avaliar. Nos relatórios da madrugada, várias colunas aparecem com números sem sentido, campos vazios e alertas contraditórios.",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-alquilacion-alfa",
    userInput: {
      explanation:
        "La causa fue que la transformación ocurrió en más de un punto posible de la molécula, así que el proceso produjo una mezcla de compuestos difíciles de separar.",
      finding:
        "En el dibujo del compuesto de partida hay dos posiciones muy parecidas donde podía ocurrir el cambio, y en los antecedentes del proceso ya se habían reportado mezclas pequeñas de dos variantes. Sin embargo, en las corridas buenas esas variantes quedaban en niveles bajos y esta vez la proporción entre ellas salió mucho más desordenada.",
      language: "es",
      scenario:
        "Estás revisando una corrida en la planta y el lote salió con muy poco producto útil y demasiadas impurezas. El procedimiento parecía rutinario, pero esta vez aparecieron compuestos inesperados y nadie sabe en qué paso se torció todo.",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-economics-business-cycle-phases",
    userInput: {
      explanation:
        "Your expansion was based on unusually strong early-year results that couldn't last, so the second-half drop reflects a broader slowdown rather than a store-level mistake.",
      finding:
        "The first half included a holiday shift that pushed seasonal purchases earlier than usual, and several regions also saw one-time jumps during a short stretch of unusually strong foot traffic. However, some of the cities where those boosts were largest still held up reasonably well into midsummer before dropping later.",
      language: "en",
      scenario:
        "You run strategy for a retail chain that opened 18 new stores after a strong first half of the year. By early fall, sales are sliding, inventory is piling up, and the new locations are missing their targets even in cities that looked promising.",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-transformacao-gradual",
    userInput: {
      explanation:
        "Uma mudança recente em uma parte do sistema passou a desviar pedidos para um serviço novo, mas esse caminho ainda não cobre todos os casos e está deixando operações pela metade.",
      finding:
        "Nos registros das etapas da compra, os pedidos problemáticos seguem o caminho antigo no começo e depois parte deles é enviada para um serviço novo antes da finalização. No entanto, há alguns pedidos com esse mesmo desvio que terminam normalmente, e outros que falham sem passar por esse ponto.",
      language: "pt",
      scenario:
        "Você faz parte da equipe de um produto que ficou anos crescendo sem parar, e agora os erros aumentaram sempre que uma compra passa por etapas específicas do fluxo. O site continua no ar, mas cada ajuste parece consertar um pedaço e quebrar outro, e você precisa descobrir o que realmente está acontecendo sem parar a operação.",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-history-biomedical-institutions",
    userInput: {
      explanation:
        "The vaccination campaign stalled because local labs had the right buildings but not enough trained staff and tested routines to scale up safely.",
      finding:
        "Internal manuals exist for the main production steps, and a few batches before the outbreak followed the same checklist from start to finish. However, audit notes show several steps were still being adjusted between batches, and some records from different sites use different timing and cleanliness checks for the same task.",
      language: "en",
      scenario:
        "You're advising officials as a new disease spreads, but the national vaccination campaign keeps falling behind schedule. Some regions are waiting for doses while others get shipments late, and you need to figure out why the country couldn't respond faster.",
    },
  },
];
