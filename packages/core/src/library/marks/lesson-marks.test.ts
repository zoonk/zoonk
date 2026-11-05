import { randomUUID } from "node:crypto";
import { matchLessonIcons } from "@zoonk/ai/tasks/icons/match";
import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { prisma } from "@zoonk/db";
import {
  languageLessonFixture,
  lessonIconFixture,
  playableLessonFixture,
} from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it, vi } from "vitest";
import { readSavedLessonMap } from "../lessons/lesson-map";
import { linkLessonIcons, pickLessonIcons } from "./lesson-icons";
import { tagLessonMarks } from "./tag-lesson-marks";

const ideas = [
  { label: "A cloud", text: "The electron spreads around the nucleus as a cloud." },
  { label: "Reading it", text: "The darker the cloud, the likelier the electron is there." },
];

function uniqueName(base: string) {
  return `${base} ${randomUUID().replaceAll(/[\d-]/gu, "").slice(0, 8)}`;
}

function need(name: string) {
  return { description: `A drawing of a ${name}`, name, searchWords: [] };
}

function taggedAs({ cloud, nucleus }: { cloud: string; nucleus: string }) {
  vi.mocked(tagLesson).mockImplementation(async ({ screens }) => ({
    data: {
      ideas: [
        { about: "What the electron does", icon: need(cloud) },
        { about: "How to read the cloud", icon: need(nucleus) },
      ],
      screens: screens.map((screen) => ({
        example: null,
        icon: screen.kind === "explanation" ? need(cloud) : null,
        ideaIndex: screen.kind === "workedExample" ? 1 : 0,
        underline: screen.kind === "explanation" ? "a map of where it might be" : null,
      })),
    },
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  }));
}

async function readMarks(lessonId: string) {
  const [steps, lesson] = await Promise.all([
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { kind: true, marks: true },
      where: { lessonId },
    }),
    prisma.lesson.findUniqueOrThrow({ select: { summary: true }, where: { id: lessonId } }),
  ]);

  return { ideas: readSavedLessonMap(lesson.summary)?.ideas ?? [], steps };
}

describe(tagLessonMarks, () => {
  it("tags the teaching screens and the map once, and asks for each icon once however many marks use it", async () => {
    const [cloud, nucleus] = [uniqueName("electron cloud"), uniqueName("atom")];
    taggedAs({ cloud, nucleus });

    const { lesson } = await playableLessonFixture({
      lesson: { summary: { ideas, shape: "hub" } },
      steps: ["hook", "explanation", "workedExample", "check", "spokenAnswer"],
    });

    const tagged = await tagLessonMarks({ lessonId: lesson.id });

    expect(tagged?.contentScope).toBe("shared");
    expect(tagged?.requests.map((request) => request.need.name)).toStrictEqual([cloud, nucleus]);

    expect(
      vi.mocked(tagLesson).mock.calls[0]?.[0].screens.map((screen) => screen.kind),
    ).toStrictEqual(["guess", "explanation", "workedExample", "question"]);

    const { ideas: saved, steps } = await readMarks(lesson.id);

    expect(steps.map((step) => step.marks)).toStrictEqual([
      {
        example: null,
        iconId: null,
        iconNeed: null,
        iconPending: false,
        ideaIndex: 0,
        underline: null,
      },
      {
        example: null,
        iconId: null,
        iconNeed: need(cloud),
        iconPending: true,
        ideaIndex: 0,
        underline: "a map of where it might be",
      },
      {
        example: null,
        iconId: null,
        iconNeed: null,
        iconPending: false,
        ideaIndex: 1,
        underline: null,
      },
      {
        example: null,
        iconId: null,
        iconNeed: null,
        iconPending: false,
        ideaIndex: 0,
        underline: null,
      },
      null,
    ]);

    expect(saved.map(({ about, iconPending }) => ({ about, iconPending }))).toStrictEqual([
      { about: "What the electron does", iconPending: true },
      { about: "How to read the cloud", iconPending: true },
    ]);

    await expect(tagLessonMarks({ lessonId: lesson.id })).resolves.toStrictEqual(tagged);
    expect(tagLesson).toHaveBeenCalledOnce();
  });

  it("leaves a language lesson alone and never writes over a map rewritten meanwhile", async () => {
    const { lesson: language } = await languageLessonFixture();
    await expect(tagLessonMarks({ lessonId: language.id })).resolves.toBeNull();

    const { lesson } = await playableLessonFixture({
      lesson: { summary: { ideas, shape: "hub" } },
      steps: ["explanation"],
    });

    const rewritten = { ideas: [{ text: "A new idea, written while tagging ran." }], shape: "hub" };

    vi.mocked(tagLesson).mockImplementation(async () => {
      await prisma.lesson.update({ data: { summary: rewritten }, where: { id: lesson.id } });

      return {
        data: { ideas: [{ about: "Stale", icon: null }], screens: [] },
        provenance: {} as never,
        systemPrompt: "",
        usage: {} as never,
        userPrompt: "",
      };
    });

    await tagLessonMarks({ lessonId: lesson.id });

    expect(tagLesson).toHaveBeenCalledOnce();
    await expect(readMarks(lesson.id)).resolves.toMatchObject({ ideas: rewritten.ideas });
  });
});

describe(pickLessonIcons, () => {
  it("reuses a drawn icon of the same name or the one the reuse check picks, and claims the rest to draw", async () => {
    const [sameName, similar] = await Promise.all([
      lessonIconFixture({ name: uniqueName("hourglass") }),
      lessonIconFixture({ name: uniqueName("balance scale"), tags: ["justice", "scales"] }),
    ]);

    const fresh = uniqueName("rubber stamp");
    const synonym = { ...need(uniqueName("scales of justice")), searchWords: ["justice"] };

    vi.mocked(matchLessonIcons).mockImplementation(async ({ needs }) => ({
      data: needs.map((item) => (item.need.name === synonym.name ? similar.id : null)),
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    }));

    const runId = `run-${randomUUID()}`;

    const picked = await pickLessonIcons({
      requests: [
        ...[sameName.name, fresh].map((name) => ({ need: need(name), usedFor: "a screen" })),
        { need: synonym, usedFor: "a screen about the courts" },
      ],
      runId,
    });

    expect(picked).toStrictEqual([
      { iconId: sameName.id, name: sameName.name, state: "ready" },
      { iconId: expect.any(String), name: fresh, state: "draw" },
      { iconId: similar.id, name: synonym.name, state: "ready" },
    ]);

    expect(
      vi.mocked(matchLessonIcons).mock.calls[0]?.[0].needs.map((item) => item.need.name),
    ).not.toContain(sameName.name);
  });

  it("waits for a name another run is drawing instead of drawing it twice", async () => {
    const drawing = await lessonIconFixture({
      name: uniqueName("compass"),
      smallUrl: null,
      status: "running",
      url: null,
    });

    await expect(
      pickLessonIcons({
        requests: [{ need: need(drawing.name), usedFor: "a screen" }],
        runId: "another-run",
      }),
    ).resolves.toStrictEqual([{ iconId: drawing.id, name: drawing.name, state: "wait" }]);

    expect(matchLessonIcons).not.toHaveBeenCalled();
  });
});

describe(linkLessonIcons, () => {
  it("links drawn icons to every screen and idea that asked for them and stops waiting for the others", async () => {
    const [cloud, nucleus] = [uniqueName("electron cloud"), uniqueName("atom")];
    taggedAs({ cloud, nucleus });

    const { lesson } = await playableLessonFixture({
      lesson: { summary: { ideas, shape: "hub" } },
      steps: ["explanation", "explanation"],
    });

    await tagLessonMarks({ lessonId: lesson.id });

    const [drawn, failed] = await Promise.all([
      lessonIconFixture({ name: cloud }),
      lessonIconFixture({ name: nucleus, smallUrl: null, status: "failed", url: null }),
    ]);

    await linkLessonIcons({
      lessonId: lesson.id,
      picked: [
        { iconId: drawn.id, name: cloud },
        { iconId: failed.id, name: nucleus },
      ],
    });

    const { ideas: saved, steps } = await readMarks(lesson.id);

    expect(steps.map((step) => step.marks)).toMatchObject([
      { iconId: drawn.id, iconPending: false },
      { iconId: drawn.id, iconPending: false },
    ]);

    expect(saved.map(({ iconId, iconPending }) => ({ iconId, iconPending }))).toStrictEqual([
      { iconId: drawn.id, iconPending: false },
      { iconId: null, iconPending: false },
    ]);
  });
});
