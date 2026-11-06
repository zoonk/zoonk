import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";

type BroadLesson = {
  context: {
    chapterTitle: string;
    courseTitle: string;
    language: string;
    level: "advanced" | "beginner" | "intermediate" | "overview";
  };
  spec: LessonSpec;
};

/**
 * Plans from a broad sample of knowledge lessons (sciences, humanities, business, technology,
 * health), every level, Portuguese and English, as the planner wrote them on 4 Nov 2026, so writers
 * are compared on the same plans.
 */
export const BROAD_LESSONS: Record<string, BroadLesson> = {
  "en-burns-first-aid": {
    context: {
      chapterTitle: "Everyday injuries",
      courseTitle: "First Aid",
      language: "en",
      level: "beginner",
    },
    spec: {
      canDo: "Decide when a burn needs urgent help",
      description: "Recognize warning signs that a burn needs emergency or prompt medical care.",
      estimatedMinutes: 4,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Caleb touches a hot pan and pulls his hand away. How can he tell whether the burn needs medical attention?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A small burn that is painful and red, without blisters, usually affects only the skin's surface.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A patch of burned skin looks white and feels numb. How serious might it be? Options: Minor; serious; impossible to injure. Answer: Serious.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A deep burn may look white, brown, or charred and can be numb because nerves are damaged.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Call 911 for a deep burn or a large burn; don't wait for pain to judge its seriousness.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Ask what to do for a small, charred, numb patch after a fire: call 911. Include waiting to see if it starts hurting as the tempting wrong answer.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A burn with blisters extends below the skin's surface and may need medical care, even if it is small.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Get prompt medical care for a burn on the face, hands, feet, genitals, or over a major joint, even if it looks small.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Get prompt medical care for a burn larger than the injured person's palm, including their fingers.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A small blistered burn crosses Iris's knee. Compare its location with the warning signs: it is over a major joint, so she needs prompt medical care.",
          kind: "workedExample",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Ask whether a small blistered burn on a foot needs prompt medical care. Include treating it at home solely because it is small as the tempting wrong answer.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "After a fire, trouble breathing or a hoarse voice can signal damage from breathing in smoke; call 911.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "After escaping a kitchen fire, Trevor has a small red burn on his arm and a new hoarse voice. Ask what to do first: call 911; include treating only the visible burn as the tempting wrong answer.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Use a burn's appearance, location, size, and associated symptoms to decide when to get help.",
          example:
            "A small burn across a knee needs prompt medical care because it crosses a major joint.",
          hard: true,
          name: "Recognize burns needing medical help",
          topic: "Burn severity",
          useCase: "Decide whether to call 911 or seek prompt care after a burn.",
        },
      ],
      title: "Recognizing serious burns",
    },
  },
  "en-dns": {
    context: {
      chapterTitle: "How the internet finds things",
      courseTitle: "Computer Networks",
      language: "en",
      level: "intermediate",
    },
    spec: {
      canDo: "Trace how DNS resolves a name to an IP address",
      description:
        "Follow a DNS lookup from a device through the servers that can provide an IP address.",
      estimatedMinutes: 6,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Carlos enters a website name in his browser, and the page appears. How does his device find the server from that name?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "An IP address is a network address a device can use to reach a server, such as 192.0.2.10.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A device asks for the address of a site it visited recently. Where might the answer come from? Options: a saved answer; several servers contacted in sequence; the website itself. Answer: a saved answer.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A recursive resolver is a server that finds addresses for devices; it can reuse a saved answer for a recently requested name.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A saved DNS answer normally has a time to live (TTL), which limits how long it can be reused; a 60-second TTL allows reuse for up to 60 seconds.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A resolver saved an answer with a 60-second TTL 20 seconds ago. Ask whether it can reuse that answer; include the tempting mistake that every request must start a new lookup.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "When it needs to look up a name and has no useful saved information, the resolver can ask a root server where to find servers for the name's ending, such as .com.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A top-level domain (TLD) server for .com can point the resolver toward the servers responsible for example.com.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "An authoritative server holds answers for a domain; for example, it can return an IP address for www.example.com.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Trace a hypothetical uncached lookup for www.example.com: device asks resolver; root points to .com servers; a .com server points to example.com's authoritative server; that server returns 192.0.2.10, which the resolver sends to the device.",
          kind: "workedExample",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "For an uncached lookup of shop.example.com, ask which server supplies the address after the resolver has received the referrals. Include the tempting wrong answer that the root server supplies it.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: "processOrder",
          brief:
            "Order an uncached lookup: device asks resolver; root points to the TLD servers; TLD server points to the authoritative server; authoritative server returns the address; resolver returns it to the device. Ask why the resolver contacts the authoritative server after the TLD server.",
          kind: "activity",
          skills: [0],
          visual: null,
          visualKind: "template",
        },
        {
          activityTemplate: null,
          brief:
            "An authoritative server may report that a name has no address of the requested kind; for example, a name may have no IPv4 address even if it has another kind of address.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A lookup reports no IPv4 address for a name. Ask what that establishes; include the tempting wrong answer that the name cannot have any other kind of address.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Finding an address is separate from connecting to it: after a resolver returns an address, the browser still has to contact the server.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Hannah's browser requests a site; its resolver has no useful saved information and eventually returns an address. Ask what the resolver must obtain before answering and what the browser must do afterward; include the tempting mistake that the returned address is the page itself.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Trace how a recursive resolver finds or reuses an IP address for a domain name.",
          example:
            "A resolver follows root and .com referrals to find 192.0.2.10 for www.example.com in a hypothetical lookup.",
          hard: true,
          name: "Trace a DNS name lookup",
          topic: "DNS resolution",
          useCase: "Follow a website lookup when diagnosing why a device cannot reach a server.",
        },
      ],
      title: "How DNS resolves a name",
    },
  },
  "en-michaelis-menten": {
    context: {
      chapterTitle: "Enzymes",
      courseTitle: "Biochemistry",
      language: "en",
      level: "advanced",
    },
    spec: {
      canDo: "Interpret Michaelis-Menten parameters and predict initial reaction rates",
      description:
        "Explore how substrate concentration affects enzyme reaction rates and what Km and Vmax reveal.",
      estimatedMinutes: 5,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Tyler adds more glucose to a tube containing a glucose-processing enzyme, but the reaction barely speeds up. Why does adding more glucose have so little effect?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "An enzyme acts on a molecule called its substrate: glucose is the substrate for Tyler’s enzyme. Write its concentration as [S].",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "With a fixed amount of enzyme, what happens to the reaction speed just after mixing as glucose concentration keeps increasing? Options: It keeps rising proportionally; it approaches a ceiling; it falls toward zero. Answer: It approaches a ceiling.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "At high glucose concentration, most enzyme molecules are busy, so adding more glucose has little effect on speed.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "The speed approaches a limit called Vmax: for example, an enzyme preparation might approach 10 µM of product per minute as [S] increases.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "The initial rate, v₀, is the speed measured near the start, before much substrate is used up or product accumulates.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A preparation has Vmax = 10 µM/min and already runs at 9.9 µM/min. Predict whether doubling [S] could raise its initial rate to 19.8 µM/min; include that doubling as the tempting wrong answer.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Km is the substrate concentration at half Vmax: if Vmax is 10 µM/min and v₀ is 5 µM/min at [S] = 2 µM, Km is 2 µM.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: "formulaModel",
          brief:
            "For a Michaelis-Menten reaction, v₀ = Vmax[S]/(Km + [S]). Show a model with Vmax = 12 µM/min, Km = 2 µM and an [S] slider from 0 to 20 µM; plot v₀ against [S].",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "template",
        },
        {
          activityTemplate: null,
          brief:
            "Work out v₀ when Vmax = 12 µM/min, Km = 2 µM and [S] = 4 µM: substitute 12 × 4/(2 + 4), then calculate 8 µM/min.",
          kind: "workedExample",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Calculate v₀ for Vmax = 15 µM/min, Km = 3 µM and [S] = 6 µM. The answer is 10 µM/min; include 30 µM/min as a tempting error from omitting [S] in the denominator.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A lower Km means half Vmax is reached at a lower [S]: an enzyme with Km = 2 µM reaches that fraction sooner than one with Km = 8 µM.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Km does not necessarily measure binding affinity alone: it can reflect both substrate release and conversion to product.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Two enzymes have the same Km for a substrate. Decide whether that proves they bind it equally strongly; include “yes, equal Km proves equal binding affinity” as the tempting wrong answer.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "The model assumes a steady state: during the rate measurement, the amount of enzyme with substrate bound is roughly constant. It also assumes substrate is in excess over enzyme.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A lab compares two preparations at [S] = 2 µM: A has Vmax = 12 µM/min and Km = 2 µM; B has Vmax = 18 µM/min and Km = 8 µM. Calculate which is faster initially: A gives 6 µM/min, while B gives 3.6 µM/min.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Use the Michaelis-Menten equation to interpret substrate dependence, Km and Vmax for an initial reaction rate.",
          example: "With Vmax = 12 µM/min and Km = 2 µM, [S] = 4 µM gives v₀ = 8 µM/min.",
          hard: true,
          name: "Predict Michaelis-Menten reaction rates",
          topic: "Michaelis-Menten kinetics",
          useCase:
            "Compare enzyme preparations at substrate concentrations used in a laboratory assay.",
        },
      ],
      title: "Michaelis-Menten kinetics",
    },
  },
  "en-ph-scale": {
    context: {
      chapterTitle: "Acids and bases",
      courseTitle: "Chemistry",
      language: "en",
      level: "beginner",
    },
    spec: {
      canDo: "Interpret pH readings for water-based solutions",
      description:
        "Learn what pH readings mean and use them to compare acidic and basic solutions.",
      estimatedMinutes: 5,
      screens: [
        {
          activityTemplate: null,
          brief:
            "A lab meter reads 3 for one water sample and 5 for another. What do those numbers tell us about the samples?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Water-based samples contain tiny charged particles called hydrogen ions; a lake sample can have more or fewer of them.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A water sample gains hydrogen ions. What happens to its meter reading? Options: falls; rises; stays unchanged. Answer: falls.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "The pH reading reflects the amount of hydrogen ions: more ions mean a lower pH. For example, a dilute sample at pH 4 has more than one at pH 5.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "For dilute solutions, each drop of one pH unit means about 10 times as many hydrogen ions. A sample at pH 3 has about 10 times as many as one at pH 4.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Compare dilute samples at pH 2 and pH 4. From 4 to 3 is 10 times as many hydrogen ions; from 3 to 2 is another 10 times, so the pH 2 sample has about 100 times as many.",
          kind: "workedExample",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Compare dilute samples at pH 5 and pH 6: how many times as many hydrogen ions does the lower-pH sample have? Answer: about 10 times; include the tempting wrong answer 1 time.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "At 25°C, a solution at pH 7 is neutral: it is neither acidic nor basic. Pure water at 25°C is an example.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "At 25°C, a solution below pH 7 is acidic. For example, a sample at pH 6 is acidic even though it is close to 7.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief: "At 25°C, a solution above pH 7 is basic. For example, a sample at pH 8 is basic.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: "categorize",
          brief:
            "Sort samples at 25°C into acidic, neutral, or basic: pH 2, 6.9, 7.0, 7.1, and 11. Ask which group gets pH 7.0; it is neutral, not acidic.",
          kind: "activity",
          skills: [0],
          visual: null,
          visualKind: "template",
        },
        {
          activityTemplate: null,
          brief:
            "The scale is often shown from 0 to 14, but concentrated solutions can fall outside it. At 25°C, a sample at pH −1 is still acidic.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A lab reports a sample at pH 15 and 25°C. Decide whether it is basic or whether the reading must be impossible; answer: basic.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A lab compares a dilute sample at pH 5 with pure water at pH 7, both at 25°C. Choose the sample’s classification and comparison: acidic with about 100 times as many hydrogen ions; include acidic with about twice as many as a tempting wrong answer.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Use pH to identify acidic, neutral, and basic solutions and compare their hydrogen ion amounts.",
          example:
            "At 25°C, a dilute solution at pH 5 is acidic and has about 10 times as many hydrogen ions as one at pH 6.",
          hard: true,
          name: "Interpret pH readings",
          topic: "pH scale",
          useCase: "Compare water samples using readings from a lab pH meter.",
        },
      ],
      title: "The pH scale",
    },
  },
  "pt-circuitos-serie-paralelo": {
    context: {
      chapterTitle: "Circuitos elétricos",
      courseTitle: "Física: Eletricidade",
      language: "pt",
      level: "intermediate",
    },
    spec: {
      canDo: "Determinar corrente e tensão em circuitos em série",
      description:
        "Como corrente e tensão se comportam em série e o que acontece quando uma lâmpada queima.",
      estimatedMinutes: 4,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Uma lâmpada de uma guirlanda queima, e todas as outras apagam. Por que uma falha pode interromper todas as luzes?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em um circuito em série, os componentes ficam em um único caminho fechado, como as duas lâmpadas da figura.",
          kind: "explanation",
          skills: [0],
          visual:
            "Esquema de uma pilha ligada por fios a duas lâmpadas identificadas como A e B, uma após a outra, formando um único caminho fechado.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Qual corrente passa pela lâmpada B? Opções: maior que em A; igual à de A; menor que em A. Resposta: igual à de A.",
          kind: "guess",
          skills: [0],
          visual:
            "Esquema de uma pilha ligada por fios a duas lâmpadas identificadas como A e B, uma após a outra, formando um único caminho fechado.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Em série, a corrente elétrica é igual em todos os pontos: se passa 0,2 A por A, passa 0,2 A por B.",
          kind: "explanation",
          skills: [0],
          visual:
            "Esquema de uma pilha ligada por fios a duas lâmpadas identificadas como A e B, uma após a outra, formando um único caminho fechado.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Em uma lanterna com dois componentes em série, passam 0,4 A pelo segundo. Determine a corrente no primeiro; inclua 0,8 A como erro de somar correntes.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A tensão da fonte se reparte entre os componentes em série: em uma fonte ideal de 9 V, as tensões dos dois componentes somam 9 V.",
          kind: "explanation",
          skills: [0],
          visual:
            "Esquema de uma fonte ideal de 9 V ligada por fios a dois componentes identificados como A e B, um após o outro, em um circuito fechado.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "As tensões não precisam ser iguais: dois componentes diferentes em série podem receber 3 V e 6 V de uma fonte de 9 V.",
          kind: "explanation",
          skills: [0],
          visual:
            "Esquema de uma fonte ideal de 9 V ligada por fios a dois componentes identificados como A e B, um após o outro, em um circuito fechado.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Em série, uma fonte ideal fornece 12 V; A recebe 5 V e a corrente em A é 0,2 A. Mostre: tensão em B = 12 − 5 = 7 V; corrente em B = 0,2 A.",
          kind: "workedExample",
          skills: [0],
          visual:
            "Esquema de uma fonte ideal de 12 V ligada em série aos componentes A e B; indicar 5 V e 0,2 A em A, sem indicar os valores em B.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Uma fonte ideal de 10 V alimenta A e B em série; A recebe 4 V e conduz 0,3 A. Determine a tensão e a corrente em B; inclua 5 V como divisão igual indevida da tensão.",
          kind: "check",
          skills: [0],
          visual:
            "Esquema de uma fonte ideal de 10 V ligada em série aos componentes A e B; indicar 4 V e 0,3 A em A, sem indicar os valores em B.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Se uma lâmpada queimada abre o caminho em série, a corrente cai a zero em todo o circuito.",
          kind: "explanation",
          skills: [0],
          visual:
            "Esquema de uma pilha e duas lâmpadas em série, com uma interrupção visível no filamento da primeira lâmpada e a segunda apagada.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Em uma sequência de três lâmpadas em série, a lâmpada do meio queima e abre o circuito. Decida o que acontece com as outras; inclua como erro que apenas a última apaga.",
          kind: "check",
          skills: [0],
          visual:
            "Esquema de uma pilha e três lâmpadas identificadas como A, B e C em série, com uma interrupção visível no filamento de B; não indicar se A e C estão acesas.",
          visualKind: "picture",
        },
        {
          activityTemplate: null,
          brief:
            "Uma decoração tem duas lâmpadas em série numa fonte ideal de 12 V. Antes de A queimar, B recebe 8 V; determine a tensão em A e a corrente em B depois que A abre o circuito.",
          kind: "application",
          skills: [0],
          visual:
            "Esquema de uma fonte ideal de 12 V ligada em série às lâmpadas A e B; indicar 8 V em B antes da falha, sem indicar a tensão em A nem a corrente após a falha.",
          visualKind: "picture",
        },
      ],
      skills: [
        {
          description:
            "Determinar corrente e tensão em um circuito em série e prever o efeito de uma interrupção.",
          example:
            "Em série, uma fonte de 12 V alimenta dois componentes: se um recebe 5 V, o outro recebe 7 V.",
          hard: true,
          name: "Determinar corrente e tensão em série",
          topic: "Circuitos em série",
          useCase: "Interpretar o funcionamento de uma sequência de lâmpadas em uma decoração.",
        },
      ],
      title: "Corrente e tensão em circuitos em série",
    },
  },
  "pt-compassos": {
    context: {
      chapterTitle: "Ritmo",
      courseTitle: "Teoria Musical",
      language: "pt",
      level: "beginner",
    },
    spec: {
      canDo: "Interpretar fórmulas de compasso e a duração de cada compasso",
      description:
        "Entenda como os compassos agrupam a música e como ler os números da fórmula de compasso.",
      estimatedMinutes: 5,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Tainá acompanha uma música contando “um, dois, três” e recomeça a contagem várias vezes. Como ela sabe quando voltar ao um?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "O pulso é a batida regular que você acompanha na música: por exemplo, cada número em “um, dois, três”.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Para preencher três pulsos, qual é o menor número de notas que pode ser tocado? Opções: uma, três, seis. Resposta: uma.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Uma única nota pode soar durante os três pulsos: não é preciso tocar uma nota em cada pulso.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "O compasso é um trecho da música separado por barras na partitura: em “| 1 2 3 | 1 2 3 |”, cada trecho tem três pulsos.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Peça para completar “| 1 2 3 1 2 3 |” com uma barra entre os compassos de três pulsos. Inclua a opção de colocar a barra depois do segundo pulso; a correta é depois do terceiro.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A fórmula de compasso é o par de números no início da partitura que indica a duração de cada compasso, como em 3/4.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em 3/4, o número de cima indica três unidades de duração por compasso, não necessariamente três notas tocadas.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em 3/4, o 4 de baixo indica que a unidade de duração é a semínima, uma figura musical.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Leia 3/4 passo a passo: o 3 indica três unidades; o 4 indica semínimas; portanto, cada compasso dura três semínimas.",
          kind: "workedExample",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Pergunte quantas semínimas preenchem um compasso em 2/4. A resposta é duas; inclua quatro como erro de confundir o número de baixo com a quantidade.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em 6/8, o 8 de baixo indica que a unidade de duração é a colcheia: o compasso dura seis colcheias.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em 6/8, é comum sentir dois pulsos por compasso, cada um com a duração de três colcheias.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em um 6/8 com dois pulsos, peça para escolher como as seis colcheias se agrupam. A resposta é três por pulso; inclua uma por pulso como erro de tratar cada colcheia como um pulso.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Duas colcheias duram o mesmo que uma semínima: um compasso pode combinar figuras de durações diferentes.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Em uma partitura em 3/4, um compasso já tem uma semínima e duas colcheias. Pergunte quantas semínimas faltam para completá-lo: uma; inclua zero como erro de contar as três notas em vez de suas durações.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Usar os números da fórmula para determinar a duração de um compasso em figuras musicais.",
          example: "Em 3/4, cada compasso tem duração equivalente a três semínimas.",
          hard: true,
          name: "Interpretar fórmulas de compasso",
          topic: "Fórmula de compasso",
          useCase: "Ler uma partitura e acompanhar a duração de seus compassos.",
        },
      ],
      title: "Compasso e fórmula de compasso",
    },
  },
  "pt-custos-fixos-variaveis": {
    context: {
      chapterTitle: "Custos do negócio",
      courseTitle: "Gestão de Pequenos Negócios",
      language: "pt",
      level: "beginner",
    },
    spec: {
      canDo: "Distinguir custos fixos e variáveis pela produção",
      description: "Entenda como os custos reagem à produção para planejar os gastos do negócio.",
      estimatedMinutes: 5,
      screens: [
        {
          activityTemplate: null,
          brief:
            "A oficina de Cauê recebeu o dobro de pedidos neste mês. Por que algumas contas vão subir enquanto outras podem ficar iguais?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Para entender um gasto, compare o mesmo período com quantidades diferentes de produção: por exemplo, 20 ou 40 peças no mês.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Se Cauê não produzir nenhuma peça em um mês, mas mantiver o contrato de aluguel, o que acontece com a cobrança daquele mês? Opções: deixa de ser cobrada; continua sendo cobrada; cai pela metade. Correta: continua sendo cobrada.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "O aluguel contratado continua sendo cobrado mesmo sem produção: é um custo fixo, pois seu total não muda com a quantidade produzida naquele período.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "O material gasto para cada peça é um custo variável: seu total cresce quando mais peças são produzidas, mantendo o mesmo gasto por peça.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Uma gráfica usa uma folha de papel por cartaz. Se produzir mais cartazes pelo mesmo custo por folha, o gasto total com papel sobe ou fica igual? Inclua 'fica igual' como erro tentador.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Se nenhuma peça for feita, o gasto com material usado nessas peças é zero: não há unidades consumindo material.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Ao dividir um aluguel de R$ 300,00 entre mais peças, a parcela por peça diminui, mesmo que o aluguel total continue em R$ 300,00.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Um aluguel de R$ 300,00 é dividido entre 30 peças em um mês e 60 no outro. Qual é a parcela por peça no segundo mês? Correta: R$ 5,00; inclua R$ 10,00 como erro tentador.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Um custo fixo pode mudar por outro motivo: o aluguel pode ser reajustado no contrato, mesmo sem mudança na produção.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Um gasto pode ter parte fixa e parte variável: uma máquina alugada custa R$ 100,00 por mês mais R$ 2,00 por peça feita.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "No contrato da máquina, qual parte continua sendo cobrada mesmo sem produção? Correta: R$ 100,00 mensais; inclua R$ 2,00 por peça como erro tentador.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: "categorize",
          brief:
            "Separe em fixos e variáveis: aluguel mensal sem mudança no contrato; licença mensal de valor fechado; tecido usado por peça; embalagem usada por produto. Considere o mesmo mês e os mesmos preços.",
          kind: "activity",
          skills: [0],
          visual: null,
          visualKind: "template",
        },
        {
          activityTemplate: null,
          brief:
            "Uma oficina paga R$ 200,00 mensais por uma máquina, mais R$ 3,00 por peça. Se passar de 20 para 40 peças no mês, quanto pagará? Correta: R$ 320,00; inclua R$ 520,00 como erro de dobrar o gasto inteiro.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Distinguir gastos que permanecem iguais daqueles que mudam com a quantidade produzida, no mesmo período.",
          example: "O aluguel mensal fica igual; o material usado aumenta ao produzir mais peças.",
          hard: false,
          name: "Distinguir custos fixos e variáveis",
          topic: "Custos fixos e variáveis",
          useCase: "Prever quais gastos de um pequeno negócio mudam quando a produção cresce.",
        },
      ],
      title: "Custos fixos e variáveis",
    },
  },
  "pt-revolucao-industrial": {
    context: {
      chapterTitle: "A Revolução Industrial",
      courseTitle: "História Geral",
      language: "pt",
      level: "overview",
    },
    spec: {
      canDo: "Explicar por que a industrialização começou na Inglaterra",
      description:
        "Apresenta as condições que favoreceram o início da industrialização inglesa no século XVIII.",
      estimatedMinutes: 4,
      screens: [
        {
          activityTemplate: null,
          brief:
            "No século XVIII, oficinas inglesas começaram a usar máquinas para produzir fios de algodão em grande quantidade. Por que essa mudança começou na Inglaterra?",
          kind: "hook",
          skills: [],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "As máquinas passaram a transformar fibras de algodão em fios mais rapidamente do que o trabalho manual.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Com o crescimento das máquinas movidas a vapor, qual combustível foi mais usado para aquecê-las na Inglaterra? Opções: carvão, lenha, óleo de baleia. Resposta: carvão.",
          kind: "guess",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "A Inglaterra tinha muito carvão, que podia ser queimado para produzir o vapor usado em máquinas.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Nem toda máquina dependia do carvão: algumas fábricas de fios usavam a força da água dos rios.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Se faltasse carvão a uma região inglesa, todas as fábricas de fios precisariam parar? Peça que use o caso das máquinas movidas a água; inclua como erro tentador que todas parariam.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "O comércio pelo Atlântico, inclusive o tráfico de pessoas escravizadas, gerou lucros para alguns comerciantes britânicos.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Parte do dinheiro acumulado no comércio podia financiar máquinas e instalações para produzir tecidos.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Com o cercamento de terras antes usadas por comunidades, algumas famílias perderam acesso à terra e buscaram trabalho assalariado.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Comerciantes britânicos vendiam tecidos em mercados de outros lugares, criando oportunidades de venda para quem produzia.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Uma família perdeu acesso à terra que usava no campo. Que mudança ajudaria a explicar sua ida em busca de emprego? Inclua como erro tentador a abertura de novos mercados para tecidos.",
          kind: "check",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "O carvão, sozinho, não explica o início da industrialização: outros lugares também tinham carvão, mas não foram os primeiros a se industrializar.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
        {
          activityTemplate: null,
          brief:
            "Davi lê que a Inglaterra se industrializou primeiro apenas porque tinha carvão. Peça que escolha a resposta mais completa: havia também dinheiro para investir, pessoas em busca de trabalho e mercados para vender; inclua como erro tentador que o carvão bastava.",
          kind: "application",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description:
            "Explicar como a combinação de recursos, dinheiro, trabalhadores e mercados favoreceu a industrialização inglesa.",
          example:
            "O carvão alimentava máquinas a vapor, enquanto dinheiro do comércio podia financiar instalações.",
          hard: false,
          name: "Explicar condições da industrialização inglesa",
          topic: "Industrialização inglesa",
          useCase: "Entender explicações sobre a origem da produção industrial.",
        },
      ],
      title: "Por que a Revolução Industrial começou na Inglaterra",
    },
  },
};
