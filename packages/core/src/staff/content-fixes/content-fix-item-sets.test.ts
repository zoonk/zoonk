import { prisma } from "@zoonk/db";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import {
  approve,
  proposeFix,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

async function setup(visibility: "private" | "public" = "public") {
  const set = await itemSetFixture();
  const skill = await skillFixture({ visibility });

  const item = await itemFixture({
    content: choiceItemContent(),
    setId: set.id,
    setPosition: 0,
    skillId: skill.id,
  });

  return {
    input: {
      changes: [
        {
          id: set.id,
          model: "ItemSet",
          replace: {
            content: textSetContent("Corrected passage"),
            questions: [{ content: item.content, id: item.id }],
          },
        },
      ],
      reason: "Correct passage",
    },
    item,
    set,
  };
}

describe("whole ItemSet fixes", () => {
  it("copies passage and questions together, preserves originals and restores them", async () => {
    const { set, item, input } = await setup();
    await signInProposer();
    const fix = await proposeFix(input);
    const approver = await signInApprover();

    await expect(approve({ fixId: fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
      status: "decided",
    });

    const original = await prisma.itemSet.findUniqueOrThrow({
      include: { items: true },
      where: { id: set.id },
    });

    expect(original.content).toStrictEqual(set.content);

    expect(original.items[0]).toMatchObject({
      content: item.content,
      id: item.id,
      retiredAt: expect.any(Date),
    });

    const change = fix.changes[0];

    if (change?.model !== "ItemSet" || change.op !== "replace") {
      throw new Error("Expected whole-set replacement");
    }

    const copy = await prisma.itemSet.findUniqueOrThrow({
      include: { items: true },
      where: { id: change.replacementId },
    });

    expect(copy.content).toStrictEqual(input.changes[0]?.replace.content);
    expect(copy.items[0]).toMatchObject({ content: item.content, retiredAt: null });
    expect(copy.items[0]?.id).not.toBe(item.id);
    await signInProposer();
    const reverted = await revertFix({ fixId: fix.id, reason: "Restore original" });

    if (reverted.status !== "proposed") {
      throw new Error(JSON.stringify(reverted));
    }

    const nextApprover = await signInApprover();

    await expect(approve({ fixId: reverted.fix.id, key: nextApprover.key })).resolves.toMatchObject(
      { fix: { status: "applied" }, status: "decided" },
    );

    await expect(prisma.item.findUniqueOrThrow({ where: { id: item.id } })).resolves.toMatchObject({
      retiredAt: null,
    });

    await expect(
      prisma.item.findUniqueOrThrow({ where: { id: copy.items[0]?.id } }),
    ).resolves.toMatchObject({ retiredAt: expect.any(Date) });
  });

  it("refuses private questions", async () => {
    const { input } = await setup("private");
    await signInProposer();
    await expect(proposeContentFix(input)).resolves.toMatchObject({ status: "invalid" });
  });

  it("refuses invalid passages and missing questions", async () => {
    const { input } = await setup();
    await signInProposer();
    const change = input.changes[0];

    if (!change) {
      throw new Error("Expected change");
    }

    await expect(
      proposeContentFix({
        ...input,
        changes: [{ ...change, replace: { ...change.replace, content: {} } }],
      }),
    ).resolves.toMatchObject({ status: "invalid" });

    await expect(
      proposeContentFix({
        ...input,
        changes: [{ ...change, replace: { ...change.replace, questions: [] } }],
      }),
    ).resolves.toMatchObject({ status: "invalid" });
  });
});
