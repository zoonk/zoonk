import { randomUUID } from "node:crypto";
import { type ListeningSet } from "@zoonk/ai/tasks/v2/listening/schema";
import { writeListeningSet } from "@zoonk/ai/tasks/v2/listening/write-set";
import { vi } from "vitest";
import { generatedProvenance } from "../../items/_test-utils/generated-items";

type WrittenSet = Awaited<ReturnType<typeof writeListeningSet>>;

function choice({ evidence, skill }: { evidence: string; skill: number }) {
  return {
    context: null,
    difficulty: "medium" as const,
    evidence,
    format: "multipleChoice" as const,
    options: [
      {
        isCorrect: true,
        misconception: null,
        reason: "Said after the correction.",
        text: "Thursday",
      },
      {
        isCorrect: false,
        misconception: "Picks the first day mentioned",
        reason: "Tuesday was corrected.",
        text: "Tuesday",
      },
      {
        isCorrect: false,
        misconception: "Picks a day never said",
        reason: "Nobody says Friday.",
        text: "Friday",
      },
    ],
    question: `Which day does Tom book? ${randomUUID()}`,
    skill,
  };
}

function writtenSet(): ListeningSet {
  return {
    questions: [
      choice({ evidence: "Thursday the twelfth", skill: 2 }),
      choice({ evidence: "the small hall", skill: 7 }),
    ],
    speakers: [
      { accent: "British English", gender: "female", name: "Receptionist" },
      { accent: "Australian English", gender: "male", name: "Tom" },
    ],
    title: "Booking a hall",
    turns: [
      { speaker: "Receptionist", text: "Good morning, Riverside Sports Centre." },
      { speaker: "Tom", text: "I'd like to book the small hall, please." },
      { speaker: "Receptionist", text: "Which day?" },
      { speaker: "Tom", text: "Tuesday, no, sorry, Thursday the twelfth." },
    ],
  };
}

export function mockWrittenListeningSet({ problems = [] }: { problems?: string[] } = {}) {
  const set = writtenSet();
  const provenance = generatedProvenance();

  const written = {
    data: { problems, set },
    provenance: { ...provenance, latencyMs: 1000, provider: "openai", requestedModel: "test" },
    systemPrompt: "",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    userPrompt: "",
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Storing a set reads only its data and the run that wrote it.
  vi.mocked(writeListeningSet).mockResolvedValue(written as WrittenSet);

  return { provenance, set };
}
