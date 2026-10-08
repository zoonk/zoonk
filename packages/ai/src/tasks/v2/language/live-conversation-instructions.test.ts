import { describe, expect, it, vi } from "vitest";
import {
  type LiveConversationInstructionsParams,
  buildLiveConversationInstructions,
} from "./live-conversation-instructions";

/** The builder's whole job is filling the real templates, so tests read them instead of stubbing. */
const { readPrompt } = vi.hoisted(() => ({
  readPrompt: async (fileName: string) => {
    const { readFile } = await import("node:fs/promises");
    return { default: await readFile(new URL(fileName, import.meta.url), "utf8") };
  },
}));

vi.mock("./live-conversation-instructions.prompt.md", () =>
  readPrompt("live-conversation-instructions.prompt.md"),
);

vi.mock("./live-conversation-role-play.prompt.md", () =>
  readPrompt("live-conversation-role-play.prompt.md"),
);

vi.mock("./live-conversation-speaking-mock.prompt.md", () =>
  readPrompt("live-conversation-speaking-mock.prompt.md"),
);

vi.mock("./live-conversation-speaking-mock-toefl.prompt.md", () =>
  readPrompt("live-conversation-speaking-mock-toefl.prompt.md"),
);

const apartmentCall: LiveConversationInstructionsParams = {
  kind: "unit",
  learnerLanguage: "pt",
  level: "A2",
  minutes: 3,
  scenario: {
    character: { name: "Sarah", place: "Queen Street", role: "proprietária" },
    characterBrief: "Friendly landlord. Rent is $1,200 a month. Viewings on Saturday at 10am.",
    hints: ["Is the apartment still available?", "Can I see it on Saturday?"],
    objectives: [
      { description: "Pergunte quanto custa o aluguel.", label: "Ask about the rent" },
      { description: "Marque uma visita.", label: "Book a viewing" },
    ],
    openingLine: "Hi, this is Sarah from Queen Street. How can I help?",
    situation: "Você viu um anúncio de apartamento. Ligue para a proprietária, Sarah.",
    title: "Ligar para marcar uma visita",
  },
  targetLanguage: "en",
};

describe(buildLiveConversationInstructions, () => {
  it("fills every placeholder of a unit role play with the scenario and the learner's level", () => {
    const instructions = buildLiveConversationInstructions(apartmentCall);

    expect(instructions).not.toContain("{{");
    expect(instructions).toContain("You are Sarah (proprietária, Queen Street)");
    expect(instructions).toContain('"Hi, this is Sarah from Queen Street. How can I help?"');
    expect(instructions).toContain('- "Book a viewing": Marque uma visita.');
    expect(instructions).toContain('- "Can I see it on Saturday?"');
    expect(instructions).toContain("Speak only US English");
    expect(instructions).toContain("clarification in Português Brasileiro");
    expect(instructions).toContain("The learner is at A2.");
    expect(instructions).toMatch(/Delegate to the backend when:\s+- Never\./u);
    expect(instructions).toContain("about 3 minutes");
  });

  it("runs a speaking mock as an examiner without the role-play hints", () => {
    const instructions = buildLiveConversationInstructions({
      ...apartmentCall,
      exam: "ielts",
      kind: "speakingMock",
      level: "B1",
      minutes: 1,
    });

    expect(instructions).not.toContain("{{");
    expect(instructions).toContain("in the style of the IELTS Speaking test");
    expect(instructions).toContain("The candidate is around B1");
    expect(instructions).not.toContain("The learner is at B1.");
    expect(instructions).not.toContain("Is the apartment still available?");
    expect(instructions).toContain("Never use Português Brasileiro");
    expect(instructions).not.toContain("clarification in");
    expect(instructions).toContain("about 1 minute.");
  });

  it("runs a TOEFL mock with Listen and Repeat, then the interview, the same at every level", () => {
    const toeflMock = {
      ...apartmentCall,
      exam: "toefl",
      kind: "speakingMock",
      minutes: 5,
    } as const;

    const instructions = buildLiveConversationInstructions({ ...toeflMock, level: "A2" });

    expect(instructions).not.toContain("{{");
    expect(instructions).toContain("in the style of the TOEFL iBT Speaking section");
    expect(instructions).toContain("1. Listen and Repeat");
    expect(instructions).toContain("2. Take an Interview");
    expect(instructions).toContain("each sentence is heard only once");
    expect(instructions).not.toContain("IELTS");
    expect(instructions).not.toContain("The learner is at A2.");
    expect(instructions).toContain("Never use Português Brasileiro");

    expect(buildLiveConversationInstructions({ ...toeflMock, level: "C1" })).toBe(instructions);
  });

  it("keeps dollar signs in scenario text as written", () => {
    const instructions = buildLiveConversationInstructions({
      ...apartmentCall,
      scenario: { ...apartmentCall.scenario, characterBrief: "Rent is $& and $1 a month." },
    });

    expect(instructions).toContain("Rent is $& and $1 a month.");
  });
});
