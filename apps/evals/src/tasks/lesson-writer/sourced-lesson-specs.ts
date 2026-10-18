import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/**
 * Lessons of goals built from official sources: the passages research stored for the goal,
 * formatted as the writer, the fix pass and the reviewer read them. Their facts (a deadline that
 * moves every year, a stability period many learners remember wrong) must come from the source.
 */
type SourcedLesson = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  level: "beginner";
  sources: string;
  spec: LessonSpec;
};

const IRS_DEADLINES = `<page ref="S1:1" of="IRS, When to file">
Individual taxpayers: the due date for filing your 2025 federal income tax return is April 15, 2026.
If you can't file by the due date, you can get an automatic 6-month extension of time to file, to October 15, 2026, by filing Form 4868 by April 15, 2026.
An extension gives you more time to file, not more time to pay. You must pay the tax you owe by April 15, 2026 to avoid interest and penalties.
</page>`;

const CF_ARTICLE_41 = `<page ref="S1:1" of="Constituição da República Federativa do Brasil de 1988, Art. 41">
Art. 41. São estáveis após três anos de efetivo exercício os servidores nomeados para cargo de provimento efetivo em virtude de concurso público.
§ 1º O servidor público estável só perderá o cargo:
I - em virtude de sentença judicial transitada em julgado;
II - mediante processo administrativo em que lhe seja assegurada ampla defesa;
III - mediante procedimento de avaliação periódica de desempenho, na forma de lei complementar, assegurada ampla defesa.
§ 4º Como condição para a aquisição da estabilidade, é obrigatória a avaliação especial de desempenho por comissão instituída para essa finalidade.
</page>`;

export const SOURCED_LESSONS: Record<"en-tax-deadlines" | "pt-estabilidade", SourcedLesson> = {
  "en-tax-deadlines": {
    chapterTitle: "Income taxes",
    courseTitle: "Personal finance",
    language: "en",
    level: "beginner",
    sources: IRS_DEADLINES,
    spec: {
      canDo: "Plan your federal tax return around its deadlines",
      description:
        "When a federal tax return is due, and what an extension does and doesn't delay.",
      estimatedMinutes: 3,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Guess that doesn't count: if you get an extension to file your federal return, do you also get more time to pay?",
          kind: "hook",
          skills: [],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "The federal return for a year's income is due the following April: the 2025 return is due April 15, 2026.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "An extension (Form 4868, filed by the due date) gives 6 more months to file, to October 15, 2026, but the tax owed is still due April 15.",
          kind: "explanation",
          skills: [1],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Someone got an extension: by when must they pay? Tempting wrong answer: October 15, 2026.",
          kind: "check",
          skills: [1],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "A freelancer in Denver needs more time to gather receipts in early April: what should they do, and by when?",
          kind: "application",
          skills: [0, 1],
          visual: null,
        },
      ],
      skills: [
        {
          description: "A year's federal return is due on April 15 of the following year.",
          example: "The 2025 return is due April 15, 2026.",
          hard: false,
          name: "Know the federal tax filing deadline",
          topic: "Tax filing deadlines",
          useCase: "Planning when to gather forms and file.",
        },
        {
          description: "An extension delays filing by 6 months, but not paying.",
          example: "With Form 4868 you file by October 15, 2026 and still pay by April 15, 2026.",
          hard: false,
          name: "Use a filing extension correctly",
          topic: "Tax filing extensions",
          useCase: "Avoiding penalties when a return isn't ready in time.",
        },
      ],
      supportMode: "explanationFirst",
      title: "Federal tax deadlines and extensions",
    },
  },
  "pt-estabilidade": {
    chapterTitle: "Agentes públicos",
    courseTitle: "Direito Administrativo",
    language: "pt",
    level: "beginner",
    sources: CF_ARTICLE_41,
    spec: {
      canDo: "Dizer quando um servidor fica estável e como pode perder o cargo",
      description:
        "Quando o servidor concursado adquire estabilidade e em que casos o servidor estável perde o cargo.",
      estimatedMinutes: 3,
      screens: [
        {
          activityTemplate: null,
          brief:
            "Palpite sem valer ponto: Ana passou num concurso e tomou posse. Depois de quanto tempo de exercício ela pode ficar estável? 2, 3 ou 5 anos.",
          kind: "hook",
          skills: [],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "O servidor nomeado por concurso para cargo efetivo fica estável após três anos de efetivo exercício, e só se for aprovado na avaliação especial de desempenho feita por uma comissão.",
          kind: "explanation",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Pedro completou três anos no cargo, mas a comissão ainda não fez a avaliação especial: ele já é estável? Pegadinha: achar que o tempo basta.",
          kind: "check",
          skills: [0],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Estável não quer dizer que nunca perde o cargo: por falta ou mau desempenho, perde por sentença judicial transitada em julgado, processo administrativo com ampla defesa ou avaliação periódica de desempenho.",
          kind: "explanation",
          skills: [1],
          visual: null,
        },
        {
          activityTemplate: null,
          brief:
            "Uma servidora estável da prefeitura de Recife é acusada de uma falta grave: o chefe pode demiti-la no mesmo dia, sem processo? Pegadinha: achar que o chefe decide sozinho.",
          kind: "application",
          skills: [1],
          visual: null,
        },
      ],
      skills: [
        {
          description:
            "O servidor concursado fica estável após três anos de efetivo exercício e aprovação na avaliação especial de desempenho.",
          example:
            "Quem tomou posse em 2023 pode ficar estável em 2026, se for aprovado na avaliação.",
          hard: false,
          name: "Identificar quando o servidor adquire estabilidade",
          topic: "Estabilidade do servidor",
          useCase: "Entender os primeiros anos de quem passa num concurso.",
        },
        {
          description:
            "Por falta ou mau desempenho, o servidor estável perde o cargo por sentença judicial, processo administrativo ou avaliação periódica, sempre com ampla defesa.",
          example: "Uma falta grave leva a um processo administrativo com direito a defesa.",
          hard: false,
          name: "Reconhecer como o servidor estável pode perder o cargo",
          topic: "Perda do cargo",
          useCase: "Questões de concurso sobre direitos do servidor.",
        },
      ],
      supportMode: "explanationFirst",
      title: "Estabilidade do servidor público",
    },
  },
};
