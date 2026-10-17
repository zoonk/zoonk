import { prisma } from "@zoonk/db";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { generatedProvenance } from "./_test-utils/generated-items";
import { findAnswerExplanation, saveAnswerExplanation } from "./answer-explanations";

async function createItem() {
  const skill = await skillFixture();
  return itemFixture({ format: "typed", skillId: skill.id });
}

describe("shared answer explanations", () => {
  it("finds a stored explanation for the same answer written differently", async () => {
    const item = await createItem();
    const target = { itemId: item.id };
    const provenance = generatedProvenance();

    const saved = await saveAnswerExplanation({
      answer: "The Chloroplast!",
      explanation: "Chloroplasts make sugar; mitochondria release its energy.",
      language: "en",
      provenance,
      target,
    });

    expect(saved).toMatchObject({
      itemId: item.id,
      language: "en",
      model: provenance.model,
      normalizedAnswer: "the chloroplast",
      runId: provenance.runId,
      stepId: null,
    });

    await expect(
      findAnswerExplanation({ answer: "  the chloroplast. ", language: "en", target }),
    ).resolves.toStrictEqual(saved);
  });

  it("keeps explanations apart by item, answer and language", async () => {
    const [item, otherItem] = await Promise.all([createItem(), createItem()]);

    await saveAnswerExplanation({
      answer: "chloroplast",
      explanation: "Explained in English.",
      language: "en",
      provenance: generatedProvenance(),
      target: { itemId: item.id },
    });

    const lookups = await Promise.all([
      findAnswerExplanation({ answer: "chloroplast", language: "pt", target: { itemId: item.id } }),
      findAnswerExplanation({
        answer: "chloroplast",
        language: "en",
        target: { itemId: otherItem.id },
      }),
      findAnswerExplanation({ answer: "ribosome", language: "en", target: { itemId: item.id } }),
      findAnswerExplanation({ answer: " ?! ", language: "en", target: { itemId: item.id } }),
    ]);

    expect(lookups).toStrictEqual([null, null, null, null]);
  });

  it("keeps the first explanation when two learners make the same mistake at once", async () => {
    const item = await createItem();
    const target = { itemId: item.id };

    const [first, second] = await Promise.all(
      ["First explanation.", "Second explanation."].map((explanation) =>
        saveAnswerExplanation({
          answer: "chloroplast",
          explanation,
          language: "en",
          provenance: generatedProvenance(),
          target,
        }),
      ),
    );

    expect(first!.id).toBe(second!.id);
    await expect(prisma.answerExplanation.count({ where: { itemId: item.id } })).resolves.toBe(1);
  });

  it("refuses to store an explanation for a blank answer", async () => {
    const item = await createItem();

    await expect(
      saveAnswerExplanation({
        answer: " . ",
        explanation: "Nothing to explain.",
        language: "en",
        provenance: generatedProvenance(),
        target: { itemId: item.id },
      }),
    ).rejects.toThrow("A blank answer has no explanation to store.");
  });
});
