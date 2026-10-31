import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { nameTopicSkills } from "./topic-skill-names";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./topic-skill-names.prompt.md", () => ({ default: "Name the shared skills." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const TOPICS = [
  {
    description: "A tabela que a Profa. Ana pediu para a prova de sexta.",
    name: "Completar a tabela das organelas para a prova da Profa. Ana",
    subject: "Biologia Celular",
  },
  { description: "Consultas para os relatórios da Acme.", name: "SQL da Acme", subject: null },
];

describe(nameTopicSkills, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the topics as data and returns the shared names in their order", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        skills: [
          {
            description: "Preencher tabelas que comparam a função de cada organela celular",
            name: "Completar tabelas comparativas das organelas celulares",
          },
          {
            description: "Escrever consultas SQL que respondem às perguntas de um relatório.",
            name: " Escrever consultas SQL para relatórios — do básico ao avançado. ",
          },
        ],
      }),
    );

    const { data, userPrompt } = await nameTopicSkills({ language: "pt", topics: TOPICS });

    expect(data).toStrictEqual([
      {
        description: "Preencher tabelas que comparam a função de cada organela celular.",
        name: "Completar tabelas comparativas das organelas celulares",
      },
      {
        description: "Escrever consultas SQL que respondem às perguntas de um relatório.",
        name: "Escrever consultas SQL para relatórios, do básico ao avançado",
      },
    ]);

    expect(userPrompt).toContain('<untrusted_input name="TOPICS">');
    expect(userPrompt).toContain("2. SQL da Acme | Consultas para os relatórios da Acme. | none");
  });

  it("never falls back to the learner's words for a topic the model left unnamed", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ description: "", name: "  " }] }),
    );

    const { data } = await nameTopicSkills({ language: "pt", topics: TOPICS });

    expect(data).toStrictEqual([null, null]);
  });
});
