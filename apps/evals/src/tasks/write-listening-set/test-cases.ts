import { type TestCase } from "@/lib/types";
import { type WriteListeningSetParams } from "@zoonk/ai/tasks/v2/listening/write-set";

type WriteListeningSetInput = Omit<
  WriteListeningSetParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "useFallback"
>;

/**
 * Task descriptions follow the exam owners' format pages (ielts.org, ets.org/toefl,
 * examenes.cervantes.es, cambridgeenglish.org, goethe.de; checked 9 Oct 2026), worded the way a
 * notice reading stores a listening section's parts. Cases run in this order, so a small `--limit`
 * covers an English learner, a Portuguese learner, typed answers and a recording played twice.
 */
export const TEST_CASES: TestCase<unknown, WriteListeningSetInput>[] = [
  {
    expectations: `IELTS Listening Part 1 for an English-speaking learner: a phone or face-to-face conversation between two people in an everyday social context (booking, registering, enquiring), at the real length of about 4 to 5 minutes (600 words or more) even though only 5 of the part's 10 questions are asked, with form or note completion answered in no more than two words and/or a number. The answers are names (spelled out letter by letter), numbers, dates, prices or addresses said in the recording; one or two answers come right after a speaker corrects themselves. Accepted answers include the spelled name and numbers as digits, each within the two-word limit and listed once. Speakers mix the British and Australian accents listed.`,
    id: "en-ielts-part-1-form-completion",
    userInput: {
      accents: ["British English", "Australian English"],
      count: 5,
      exam: "IELTS",
      formats: ["typed"],
      language: "en",
      level: "band 6",
      plays: 1,
      scriptLanguage: "en",
      skills: [
        {
          description:
            "Catch names, numbers, dates and prices in an everyday conversation, including spelled words and corrections",
          name: "Note specific details in everyday conversations",
        },
        {
          description: "Follow what two people agree on as the conversation changes",
          name: "Follow a conversation's decisions",
        },
      ],
      task: "Part 1: a conversation between two people set in an everyday social context; form completion, write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer. 10 questions in the real test.",
    },
  },
  {
    expectations: `TOEFL iBT "Listen to a Conversation" for a Brazilian learner: a campus conversation between a student and a professor or staff member, about 2 to 3 minutes, with 4-option multiple-choice questions on the main purpose, details and a speaker's attitude or implied meaning, in English. Reasons and misconceptions are in Brazilian Portuguese. Speakers use North American English, with a British or Australian accent allowed.`,
    id: "pt-toefl-campus-conversation",
    userInput: {
      accents: ["American English", "British English", "Australian English"],
      count: 4,
      exam: "TOEFL iBT",
      formats: ["multipleChoice"],
      language: "pt",
      level: "B2",
      optionCount: 4,
      plays: 1,
      scriptLanguage: "en",
      skills: [
        {
          description: "Understand why a student and a professor or staff member are talking",
          name: "Identify the purpose of a campus conversation",
        },
        {
          description: "Understand the details that support the conversation's main points",
          name: "Understand key details in academic conversations",
        },
        {
          description: "Infer what a speaker means or feels from how they say it",
          name: "Infer a speaker's attitude and implied meaning",
        },
      ],
      task: "Listen to a Conversation: a conversation on a university campus between a student and a professor or a staff member; multiple-choice questions with one answer.",
    },
  },
  {
    expectations: `DELE B2 Prueba de comprensión auditiva, Tarea 5, for a Brazilian learner: a monologue in Spanish (a talk, a lecture or a testimony on radio), about 3 minutes, with 3-option multiple-choice questions in Spanish, played twice. Wrong options use what the speaker also says or a near-paraphrase that changes a detail. Reasons and misconceptions are in Brazilian Portuguese. The Spanish is Spain's or Latin America's as the accents list.`,
    id: "pt-dele-b2-tarea-5-monologue",
    userInput: {
      accents: ["Castilian Spanish", "Mexican Spanish"],
      count: 5,
      exam: "DELE B2",
      formats: ["multipleChoice"],
      language: "pt",
      level: "B2",
      optionCount: 3,
      plays: 2,
      scriptLanguage: "es",
      skills: [
        {
          description: "Entender la idea principal y los detalles de una charla o un testimonio",
          name: "Comprender monólogos extensos",
        },
        {
          description: "Distinguir lo que afirma el hablante de lo que solo menciona",
          name: "Identificar la postura del hablante",
        },
      ],
      task: "Tarea 5: un monólogo (conferencia, testimonio o charla de radio) de unos 3 minutos; preguntas de selección múltiple con tres opciones. Se escucha dos veces.",
    },
  },
  {
    expectations: `Cambridge B2 First Listening Part 2 for an English-speaking learner: one speaker talking for 3 to 4 minutes about their work, a hobby or an experience, with sentence completion: each question is a sentence with a gap, filled with a word or short phrase the speaker says. Gaps target concrete details with distractors nearby (two things mentioned, one corrected). Exactly 6 questions; accepted answers fit a short phrase and are listed once. Played twice. British English.`,
    id: "en-cambridge-first-part-2-sentence-completion",
    userInput: {
      accents: ["British English"],
      count: 6,
      exam: "Cambridge B2 First",
      formats: ["typed"],
      language: "en",
      level: "B2",
      plays: 2,
      scriptLanguage: "en",
      skills: [
        {
          description:
            "Catch the specific word or phrase a speaker says about a topic, ignoring nearby distractors",
          name: "Pick out specific information in a monologue",
        },
      ],
      task: "Part 2: a monologue of 3 to 4 minutes; sentence completion, write a word or short phrase you hear in each gap. 10 questions in the real test.",
    },
  },
  {
    expectations: `Goethe-Zertifikat B1 Hören Teil 3 for a Brazilian learner: an everyday conversation in German between two people (friends planning something, or colleagues), about 3 minutes, with richtig/falsch statements in German about what was said, about half true. Played once. False statements change one heard detail. Reasons in Brazilian Portuguese.`,
    id: "pt-goethe-b1-horen-teil-3",
    userInput: {
      accents: ["Standard German"],
      count: 6,
      exam: "Goethe-Zertifikat B1",
      formats: ["trueFalse"],
      language: "pt",
      level: "B1",
      plays: 1,
      scriptLanguage: "de",
      skills: [
        {
          description: "Verstehen, was zwei Personen im Alltag besprechen und vereinbaren",
          name: "Alltagsgespräche im Detail verstehen",
        },
      ],
      task: "Teil 3: ein Gespräch zwischen zwei Personen im Alltag; Aussagen richtig oder falsch. Sie hören das Gespräch einmal.",
    },
  },
  {
    expectations: `IELTS Academic Listening Part 1 for a Brazilian learner, exactly as the real-AI run on 10 Oct 2026 asked it: the notice's own words for the part, its full 10 questions, every listening format allowed, no accents and no level. Two speakers arrange something in an everyday social situation for about 4 to 5 minutes (600 words or more), played once, with form or note completion: names (spelled out letter by letter), numbers, days, times and prices, several of them right after a speaker corrects themselves. Every typed question states its word limit in the question or its context the way IELTS does ("Write ONE WORD AND/OR A NUMBER."), since each question is shown on its own; the accepted answers fit that limit and include numbers as digits and in words. Speakers' accents are ones IELTS recordings use, named as varieties of English. Reasons and key points are in Brazilian Portuguese.`,
    id: "pt-ielts-part-1-from-notice",
    userInput: {
      accents: [],
      count: 10,
      exam: "IELTS Academic",
      formats: ["multipleChoice", "trueFalse", "typed"],
      language: "pt",
      level: null,
      plays: 1,
      scriptLanguage: "en",
      skills: [
        {
          description:
            "Follow what two people arrange in an everyday situation and note names, numbers, dates and prices, including spelled words and corrections.",
          name: "Understand everyday conversations",
        },
        {
          description:
            "Follow one speaker giving practical information about places, services or events, and pick out the details asked.",
          name: "Understand talks about everyday topics",
        },
        {
          description:
            "Understand the opinions, plans and reasons in a discussion between students or a lecture, and how ideas connect.",
          name: "Follow academic discussions and lectures",
        },
      ],
      task: "Part 1: a conversation between two speakers in an everyday social situation, for example, a conversation about travel arrangements",
    },
  },
  {
    expectations: `IELTS Academic Listening Part 2 for a Brazilian learner, written the way production asks it: the notice's own words for the part, the part's full 10 questions, every listening format allowed, no accents listed and no level. One main speaker talks for about 4 to 5 minutes (600 words or more) about local facilities or an event in an everyday social context, played once. Questions in English mix the formats IELTS uses for this part (multiple choice with three options, sentence or note completion within a stated word limit), follow the order of the recording and target details with distractors nearby. The speaker's accent is one IELTS recordings use (British, Australian, New Zealand, North American), named as a variety of English. Questions fit the exam's middle bands. Reasons and misconceptions are in Brazilian Portuguese.`,
    id: "pt-ielts-part-2-from-notice",
    userInput: {
      accents: [],
      count: 10,
      exam: "IELTS Academic",
      formats: ["multipleChoice", "trueFalse", "typed"],
      language: "pt",
      level: null,
      plays: 1,
      scriptLanguage: "en",
      skills: [
        {
          description:
            "Understand the main points and specific details of a talk about everyday facilities, services or events",
          name: "Understand monologues in social contexts",
        },
        {
          description:
            "Catch names, numbers, times and places in a talk, ignoring corrected details",
          name: "Note specific details heard",
        },
      ],
      task: "Part 2: there is only one main speaker, for example, a speech about local facilities",
    },
  },
];
