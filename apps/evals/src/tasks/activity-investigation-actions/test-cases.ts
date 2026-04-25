const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. ACTION COUNT: 5-6 actions total.

2. QUALITY DISTRIBUTION: 1-2 critical (directly test the core question), 2-3 useful (valuable supporting evidence), 1-2 weak (tangentially related). Penalize severely skewed distributions.

3. DOMAIN APPROPRIATENESS: Actions should use domain-appropriate language. For networking: check logs, trace routes, run diagnostics. Actions should feel like things a real investigator would do in this domain.

4. COVERAGE: Actions should cover different investigation angles — some that would confirm the best explanation, some that test alternatives, some tangential.

5. LANGUAGE: All action text must be in the specified language.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-web-packets-network-paths",
    userInput: {
      accuracy: {
        accuracies: ["partial", "best", "partial", "wrong"],
      },
      language: "en",
      scenario: {
        explanations: [
          "A recent equipment change is sending requests through a much longer chain of machines before they reach the app.",
          "The app is replying normally, but one device along the way is delaying or dropping pieces of the conversation.",
          "A misconfigured service is sending responses back toward the wrong place, so browsers keep waiting and retrying.",
          "The slowdown is inside the data center itself, where one overloaded server is making every page load look like a network problem.",
        ],
        scenario:
          "Your team's web app suddenly feels slow for users in one region, even though the servers look healthy and CPU use is normal. You need to figure out why pages are taking several extra seconds to load before support starts rolling back unrelated changes.",
      },
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-python-inf-nan",
    userInput: {
      accuracy: {
        accuracies: ["partial", "best", "partial", "wrong"],
      },
      language: "pt",
      scenario: {
        explanations: [
          "Um cálculo passou a receber um valor absurdo em uma etapa anterior, e esse número extremo contaminou o resto do pipeline até travar o fechamento.",
          "Um dado ausente ou inválido entrou como se fosse número comum, e as contas seguintes espalharam esse problema por vários relatórios.",
          "A lógica que decide quais pedidos revisar falhou ao comparar certos valores especiais, então parte dos casos críticos foi ignorada sem gerar erro claro.",
          "Uma integração externa mudou o formato de alguns campos, e o sistema começou a misturar medições reais com resultados de operações impossíveis.",
        ],
        scenario:
          "Você foi chamado porque o sistema de risco de uma fintech aprovou alguns pedidos que deveriam ter sido bloqueados e, ao mesmo tempo, marcou outros como impossíveis de avaliar. Nos relatórios da madrugada, várias colunas aparecem com números sem sentido, campos vazios e alertas contraditórios.",
      },
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.

${SHARED_EXPECTATIONS}
    `,
    id: "es-quimica-alquilacion-alfa",
    userInput: {
      accuracy: {
        accuracies: ["wrong", "best", "partial", "partial"],
      },
      language: "es",
      scenario: {
        explanations: [
          "El lote falló porque una de las materias primas venía con una pequeña impureza que desvió parte de la reacción hacia un producto casi idéntico al esperado.",
          "El problema empezó cuando el equipo usó un reactivo demasiado agresivo y, en vez de detenerse tras un solo cambio, la mezcla siguió reaccionando más de la cuenta.",
          "La causa fue que la transformación ocurrió en más de un punto posible de la molécula, así que el proceso produjo una mezcla de compuestos difíciles de separar.",
          "El rendimiento cayó porque se siguió una ruta alternativa con un intermedio distinto, más controlable en teoría, pero mal preparada en esta corrida.",
        ],
        scenario:
          "Estás revisando una corrida en la planta y el lote salió con muy poco producto útil y demasiadas impurezas. El procedimiento parecía rutinario, pero esta vez aparecieron compuestos inesperados y nadie sabe en qué paso se torció todo.",
      },
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-economics-business-cycle-phases",
    userInput: {
      accuracy: {
        accuracies: ["partial", "wrong", "partial", "best"],
      },
      language: "en",
      scenario: {
        explanations: [
          "Demand is weakening across the market, and your stores only noticed after opening new locations at the worst possible moment.",
          "A supply problem or shipping bottleneck left popular items missing, so sales fell even though customers still wanted to buy.",
          "A new competitor pulled away your best customers right as you committed to a bigger footprint and higher fixed costs.",
          "Your expansion was based on unusually strong early-year results that couldn't last, so the second-half drop reflects a broader slowdown rather than a store-level mistake.",
        ],
        scenario:
          "You run strategy for a retail chain that opened 18 new stores after a strong first half of the year. By early fall, sales are sliding, inventory is piling up, and the new locations are missing their targets even in cities that looked promising.",
      },
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-agile-transformacao-gradual",
    userInput: {
      accuracy: {
        accuracies: ["best", "partial", "partial", "wrong"],
      },
      language: "pt",
      scenario: {
        explanations: [
          "Uma mudança recente em uma parte do sistema passou a desviar pedidos para um serviço novo, mas esse caminho ainda não cobre todos os casos e está deixando operações pela metade.",
          "O problema começou porque partes antigas e novas estão consultando dados de jeitos diferentes, então alguns clientes veem informações atualizadas e outros recebem respostas antigas.",
          "A lentidão e os erros apareceram porque um módulo muito usado foi separado cedo demais, e agora a troca de mensagens entre as partes está criando filas e falhas.",
          "Nada estrutural mudou de fato; o aumento de acessos desta semana só expôs um gargalo antigo que já existia no sistema principal.",
        ],
        scenario:
          "Você faz parte da equipe de um produto que ficou anos crescendo sem parar, e agora os erros aumentaram sempre que uma compra passa por etapas específicas do fluxo. O site continua no ar, mas cada ajuste parece consertar um pedaço e quebrar outro, e você precisa descobrir o que realmente está acontecendo sem parar a operação.",
      },
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-history-biomedical-institutions",
    userInput: {
      accuracy: {
        accuracies: ["partial", "best", "wrong", "partial"],
      },
      language: "en",
      scenario: {
        explanations: [
          "A fast-growing outbreak exposed that the country depended too heavily on imported doses and couldn't replace them quickly when shipments slowed.",
          "The vaccination campaign stalled because local labs had the right buildings but not enough trained staff and tested routines to scale up safely.",
          "The delay came mostly from political fights and purchasing decisions, while the scientific institutions themselves were ready to produce far more than they were asked to.",
          "The shortage was driven by weak coordination between research centers, factories, and the health system, so discoveries were made but took too long to reach clinics.",
        ],
        scenario:
          "You're advising officials as a new disease spreads, but the national vaccination campaign keeps falling behind schedule. Some regions are waiting for doses while others get shipments late, and you need to figure out why the country couldn't respond faster.",
      },
    },
  },
];
