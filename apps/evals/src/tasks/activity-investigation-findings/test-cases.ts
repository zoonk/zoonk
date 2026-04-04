const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. FINDING COUNT: Exactly one finding per action.

2. AMBIGUITY: Every finding MUST have a complicating factor — a second observable fact that contradicts or complicates the first (e.g., using "however" in English, "no entanto" in Portuguese, "sin embargo" in Spanish). If any finding presents clear, unambiguous evidence, penalize.

3. FINDINGS ARE ONLY OBSERVABLE FACTS: Every sentence in a finding must describe something the learner can directly see, measure, count, or read in a log/report/record. Penalize ANY sentence that contains conclusions, speculation, or possibility language — phrases like "can't rule out that...", "this might mean...", "it's possible that...", "suggesting that...", "which could indicate...", or any equivalent in the content language (e.g., "não dá para descartar", "no se puede descartar", "podría indicar"). These are conclusions about what the evidence means — the learner's job, not the finding's. Each violation is a major error.

4. CONSISTENCY: Findings must be factually consistent with the scenario and domain.

5. LANGUAGE: All finding texts must be in the specified language. Complicating factor connectives must use the target language's equivalent.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-web-packets-network-paths",
    userInput: {
      accuracy: {
        accuracies: ["partial", "best", "partial", "wrong"],
      },
      actions: {
        actions: [
          {
            label: "Check where the delay happens between the user's browser and the app",
            quality: "critical",
          },
          {
            label: "Compare the path requests take from the slow region versus a normal region",
            quality: "critical",
          },
          {
            label: "Review network device records for dropped or delayed traffic on that route",
            quality: "useful",
          },
          {
            label: "Look for signs that replies are being sent back the wrong way and retried",
            quality: "useful",
          },
          {
            label: "Test page loads from several places outside the data center",
            quality: "useful",
          },
          {
            label: "Recheck one busy app server just in case it's slowing every request",
            quality: "weak",
          },
        ],
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
      actions: {
        actions: [
          {
            label: "Ver onde os campos vazios ou inválidos entram nas contas",
            quality: "critical",
          },
          { label: "Refazer o caminho dos dados nos relatórios com problema", quality: "critical" },
          {
            label: "Comparar pedidos aprovados, bloqueados e não avaliados para achar um padrão",
            quality: "useful",
          },
          { label: "Checar em que etapa os números passam a ficar sem sentido", quality: "useful" },
          {
            label: "Revisar as regras que escolhem quais pedidos vão para revisão",
            quality: "useful",
          },
          {
            label: "Olhar se houve mudança recente na troca de dados com outro sistema",
            quality: "weak",
          },
        ],
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
      actions: {
        actions: [
          {
            label: "Revisar qué reactivo se usó y si era más fuerte de lo normal",
            quality: "critical",
          },
          {
            label: "Mirar en qué momento la mezcla debió parar y si siguió cambiando después",
            quality: "critical",
          },
          {
            label:
              "Comparar los compuestos inesperados con los que aparecen cuando la reacción se pasa de largo",
            quality: "useful",
          },
          {
            label: "Revisar si la transformación podía ocurrir en más de un lugar de la molécula",
            quality: "useful",
          },
          {
            label: "Ver cómo se preparó el intermedio o paso previo en esta corrida",
            quality: "useful",
          },
          {
            label: "Comprobar si alguna materia prima venía con una impureza pequeña",
            quality: "weak",
          },
        ],
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
      actions: {
        actions: [
          {
            label: "Compare this fall's sales trend with the rest of the market",
            quality: "critical",
          },
          {
            label: "Check whether older stores are dropping in the same pattern as the new ones",
            quality: "critical",
          },
          { label: "Review what made the first half unusually strong", quality: "useful" },
          {
            label: "Look at competitor openings and promo activity in those cities",
            quality: "useful",
          },
          {
            label: "Check if key products were out of stock when sales started falling",
            quality: "useful",
          },
          {
            label: "Walk through store layout and staffing at the weakest new locations",
            quality: "weak",
          },
        ],
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
      actions: {
        actions: [
          {
            label: "Ver por onde os pedidos problemáticos estão passando em cada etapa da compra",
            quality: "critical",
          },
          {
            label:
              "Comparar pedidos que deram certo com os que ficaram pela metade depois da mudança recente",
            quality: "critical",
          },
          {
            label:
              "Revisar quando o caminho novo começou a receber pedidos e o que mudou nesse momento",
            quality: "useful",
          },
          {
            label:
              "Checar se partes diferentes estão mostrando dados diferentes para o mesmo pedido ou cliente",
            quality: "useful",
          },
          {
            label:
              "Observar se há acúmulo de espera ou travas na conversa entre as partes do sistema",
            quality: "useful",
          },
          {
            label: "Olhar o volume de acessos dos últimos dias para ver se houve pico de uso",
            quality: "weak",
          },
        ],
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
      actions: {
        actions: [
          {
            label:
              "Check whether local labs had enough trained people to run production safely at full speed",
            quality: "critical",
          },
          {
            label:
              "Look at whether the labs already had working step-by-step routines that could be repeated on a larger scale",
            quality: "critical",
          },
          {
            label:
              "Review how much the country was relying on imported doses when outside shipments slowed down",
            quality: "useful",
          },
          {
            label:
              "Trace how information and materials moved between research centers, factories, and clinics",
            quality: "useful",
          },
          {
            label:
              "Compare planned dose output with what local facilities had actually produced before the outbreak",
            quality: "useful",
          },
          {
            label: "Look over public arguments and purchasing delays between officials",
            quality: "weak",
          },
        ],
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
