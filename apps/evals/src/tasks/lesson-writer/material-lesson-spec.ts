import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/** A private lesson for a school test on Friday, planned from the teacher's slides. */
export const MATERIAL_LESSON_SPEC: LessonSpec = {
  canDo: "Calcular o saldo de ATP da glicólise",
  description: "Mostra quanto ATP a glicólise gasta e produz, e por que o saldo é 2 por glicose.",
  estimatedMinutes: 3,
  screens: [
    {
      activityTemplate: null,
      brief: "Palpite sem valer ponto: a glicólise produz 4 ATP. Quanto sobra por glicose?",
      kind: "hook",
      skills: [],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "A glicólise acontece no citoplasma (o C do macete CMC). Fase de investimento: a célula gasta 2 ATP para ativar a glicose, como o empréstimo do slide.",
      kind: "explanation",
      skills: [0],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Fase de rendimento: produz 4 ATP e 2 NADH (que levam elétrons à cadeia respiratória).",
      kind: "explanation",
      skills: [0],
      visual: null,
    },
    {
      activityTemplate: null,
      brief: "Pergunte o saldo de ATP por glicose, com a pegadinha de responder 4.",
      kind: "check",
      skills: [0],
      visual: null,
    },
    {
      activityTemplate: null,
      brief: "Pergunte onde a glicólise acontece, com a pegadinha da mitocôndria.",
      kind: "check",
      skills: [0],
      visual: null,
    },
  ],
  skills: [
    {
      description: "A glicólise gasta 2 ATP, produz 4 e termina com saldo de 2 ATP por glicose.",
      example: "4 produzidos − 2 gastos = 2 ATP",
      hard: false,
      name: "Calcular o saldo energético da glicólise",
      topic: "Glicólise",
      useCase: "Questões de prova que pedem o saldo de ATP de cada etapa",
    },
  ],
  supportMode: "explanationFirst",
  title: "Saldo de ATP da glicólise",
};
