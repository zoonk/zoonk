import { type TestCase } from "@/lib/types";
import { toItemSetStimulus } from "@zoonk/core/library/items/check-set-keys";
import { type SolveItemsExpected, type SolveItemsInput } from "./test-cases";

function option({ isCorrect, reason, text }: { isCorrect: boolean; reason: string; text: string }) {
  return { isCorrect, misconception: isCorrect ? null : "Misreads the stimulus", reason, text };
}

function choice(question: string, options: ReturnType<typeof option>[]) {
  return {
    context: null,
    difficulty: "medium" as const,
    fixedOrder: false,
    format: "multipleChoice" as const,
    image: null,
    options,
    question,
    visual: null,
  };
}

function statement({ isTrue, reason, text }: { isTrue: boolean; reason: string; text: string }) {
  return {
    context: null,
    difficulty: "medium" as const,
    format: "trueFalse" as const,
    image: null,
    isTrue,
    misconception: null,
    reason,
    statement: text,
    visual: null,
  };
}

const BAKERY_CASE = toItemSetStimulus({
  content: {
    source: null,
    text: "Marlow Bakery sells its sourdough loaf for $6.00. Flour, salt and starter cost $1.20 per loaf, packaging $0.30 and the electricity for baking $0.50. Rent and wages come to $4,200 a month whatever the bakery sells. Last month it sold 1,500 loaves.\n\nThe owner, Priya, has been offered a supermarket order of 600 extra loaves a month at $4.50 each. The supermarket would collect the loaves on its own crates, so they would need no packaging, and the bakery has enough spare oven time to bake them without new staff. Priya's accountant warns that $4.50 is below last month's average cost per loaf, $4.80.",
    title: "A supermarket order for Marlow Bakery",
  },
  kind: "case",
});

const WATER_CHART = toItemSetStimulus({
  content: {
    source: null,
    text: "O gráfico mostra o consumo mensal de água de uma escola no primeiro semestre.",
    title: "Consumo de água da escola",
    visual: {
      axisStart: null,
      categories: ["jan", "fev", "mar", "abr", "mai", "jun"],
      categoryLabel: "Mês",
      chart: "bar",
      kind: "chart",
      series: [{ name: "Consumo", values: [80, 95, 120, 160, 150, 90] }],
      source: null,
      title: "Consumo de água por mês",
      unit: "m³",
      valueLabel: "Consumo (m³)",
    },
  },
  kind: "chart",
});

const speaker = (name: string, accent: string, gender: "female" | "male") => ({
  accent,
  gender,
  key: name,
  label: name,
  voice: "Kore" as const,
});

const TENNIS_SCRIPT = toItemSetStimulus({
  content: {
    plays: 1,
    script: {
      speakers: [
        speaker("Receptionist", "British English", "female"),
        speaker("Daniel", "Australian English", "male"),
      ],
      turns: [
        { speaker: "Receptionist", text: "Good morning, Hillside Leisure Centre." },
        { speaker: "Daniel", text: "Hi, I'd like to book a tennis court for Saturday, please." },
        { speaker: "Receptionist", text: "Morning or afternoon?" },
        { speaker: "Daniel", text: "The morning. Around nine, if possible." },
        { speaker: "Receptionist", text: "Nine's taken, I'm afraid. I can do half past ten." },
        { speaker: "Daniel", text: "Half ten is fine. Oh, and there are four of us, so doubles." },
        {
          speaker: "Receptionist",
          text: "Then it's twelve pounds for the court, plus two pounds a racket if you need to hire any.",
        },
        { speaker: "Daniel", text: "Two of us have our own, so just two to hire." },
        { speaker: "Receptionist", text: "Lovely. Can I take a surname?" },
        { speaker: "Daniel", text: "Okafor. O-K-A-F-O-R." },
      ],
    },
    scriptLanguage: "en",
    task: "Part 1: a conversation between two people in an everyday social context",
    title: "Booking a tennis court",
  },
  kind: "audio",
});

export const ITEM_SET_CASES: TestCase<SolveItemsExpected, SolveItemsInput>[] = [
  {
    expectations:
      "Business case: question 1 is keyed $2.50, but a supermarket loaf needs no packaging, so it adds $4.50 − $1.20 − $0.50 = $2.80; the others are right.",
    expected: { drop: [1] },
    id: "en-business-case-bakery-order",
    language: "en",
    userInput: {
      items: [
        choice("How much does each supermarket loaf add toward rent and wages?", [
          option({ isCorrect: false, reason: "Packaging is left out.", text: "$2.80" }),
          option({ isCorrect: true, reason: "$4.50 − $2.00 = $2.50.", text: "$2.50" }),
          option({
            isCorrect: false,
            reason: "That compares with the average cost.",
            text: "−$0.30",
          }),
          option({ isCorrect: false, reason: "Electricity is a cost too.", text: "$3.30" }),
        ]),
        choice("How would taking the order change the bakery's monthly profit?", [
          option({ isCorrect: true, reason: "600 × $2.80 = $1,680.", text: "It rises by $1,680." }),
          option({
            isCorrect: false,
            reason: "Rent and wages don't change.",
            text: "It falls by $180.",
          }),
          option({ isCorrect: false, reason: "Packaging is saved.", text: "It rises by $1,500." }),
          option({ isCorrect: false, reason: "Each loaf adds $2.80.", text: "It doesn't change." }),
        ]),
        choice("Why is the accountant's warning misleading for this decision?", [
          option({
            isCorrect: true,
            reason: "Rent and wages are paid either way.",
            text: "The $4.80 includes rent and wages the bakery pays whether or not it takes the order.",
          }),
          option({
            isCorrect: false,
            reason: "It pays $4.50.",
            text: "The supermarket would pay more than $4.80 a loaf.",
          }),
          option({
            isCorrect: false,
            reason: "No new staff are needed.",
            text: "The order would need new staff.",
          }),
          option({
            isCorrect: false,
            reason: "It includes rent and wages.",
            text: "The $4.80 counts only flour, salt and starter.",
          }),
        ]),
      ],
      stimulus: BAKERY_CASE,
    },
  },
  {
    expectations:
      "Chart: statement 1 is keyed true, but April's 160 m³ is a third more than March's 120 m³, not 50% more; the others are right (the semester totals 695 m³).",
    expected: { drop: [1] },
    id: "pt-chart-school-water",
    language: "pt",
    userInput: {
      items: [
        statement({
          isTrue: true,
          reason: "Abril teve 160 m³ e março, 120 m³.",
          text: "O consumo de abril foi 50% maior que o de março.",
        }),
        statement({
          isTrue: true,
          reason: "Abril teve 160 m³, o maior valor do semestre.",
          text: "O maior consumo do semestre ocorreu em abril.",
        }),
        statement({
          isTrue: false,
          reason: "80 + 95 + 120 + 160 + 150 + 90 = 695 m³.",
          text: "O consumo total do semestre passou de 700 m³.",
        }),
        statement({
          isTrue: true,
          reason: "De 150 m³ para 90 m³ são 60 m³ a menos, 40% de 150.",
          text: "De maio para junho, o consumo caiu 40%.",
        }),
      ],
      stimulus: WATER_CHART,
    },
  },
  {
    expectations:
      "Listening script: question 1 is keyed nine, the time Daniel asked for, but nine was taken and he booked half past ten; the others are right (£12 + 2 × £2 = £16).",
    expected: { drop: [1] },
    id: "en-listening-tennis-booking",
    language: "en",
    userInput: {
      items: [
        choice("What time is the court booked for?", [
          option({ isCorrect: true, reason: "Daniel asks for nine.", text: "9:00" }),
          option({ isCorrect: false, reason: "Nine was taken.", text: "10:30" }),
          option({ isCorrect: false, reason: "Nobody says ten.", text: "10:00" }),
        ]),
        choice("How much will Daniel's group pay in total?", [
          option({ isCorrect: false, reason: "Rackets cost extra.", text: "£12" }),
          option({
            isCorrect: true,
            reason: "£12 for the court and two rackets at £2.",
            text: "£16",
          }),
          option({ isCorrect: false, reason: "Two of them have rackets.", text: "£20" }),
        ]),
        statement({
          isTrue: false,
          reason: "Two of the four have their own rackets.",
          text: "Daniel will hire a racket for every player.",
        }),
        statement({
          isTrue: true,
          reason: "There are four of them, so doubles.",
          text: "The court is booked for a doubles game.",
        }),
      ],
      stimulus: TENNIS_SCRIPT,
    },
  },
];
