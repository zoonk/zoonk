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
import { readLessonMarking, tagLessonMarks } from "./tag-lesson-marks";

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
    output: {} as never,
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
        output: {} as never,
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
  it("reuses a drawn icon of the same name or the one the reuse check picks, and leaves the rest to draw", async () => {
    const [sameName, similar] = await Promise.all([
      lessonIconFixture({ name: uniqueName("hourglass") }),
      lessonIconFixture({ name: uniqueName("balance scale"), tags: ["justice", "scales"] }),
    ]);

    const fresh = need(uniqueName("rubber stamp"));
    const synonym = { ...need(uniqueName("scales of justice")), searchWords: ["justice"] };

    vi.mocked(matchLessonIcons).mockImplementation(async ({ needs }) => ({
      data: needs.map((item) => (item.need.name === synonym.name ? similar.id : null)),
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    }));

    const picked = await pickLessonIcons({
      requests: [
        { forIdea: false, need: need(sameName.name), usedFor: "a screen" },
        { forIdea: false, need: fresh, usedFor: "a screen" },
        { forIdea: false, need: synonym, usedFor: "a screen about the courts" },
      ],
    });

    expect(picked).toStrictEqual([
      { iconId: sameName.id, name: sameName.name, need: need(sameName.name) },
      { iconId: null, name: fresh.name, need: fresh },
      { iconId: similar.id, name: synonym.name, need: synonym },
    ]);

    expect(
      vi.mocked(matchLessonIcons).mock.calls[0]?.[0].needs.map((item) => item.need.name),
    ).not.toContain(sameName.name);
  });

  it("never gives one library icon to two of the lesson's ideas: a later idea sent to a taken icon draws its own", async () => {
    const tag = uniqueName("money").replace(" ", "");

    const [coin, scale] = await Promise.all([
      lessonIconFixture({ name: uniqueName("coin"), tags: [tag] }),
      lessonIconFixture({ name: uniqueName("balance scale"), tags: [tag] }),
    ]);

    const coins = { ...need(uniqueName("coins")), searchWords: [tag] };
    const purse = { ...need(uniqueName("purse")), searchWords: [tag] };
    const justice = { ...need(uniqueName("scales of justice")), searchWords: [tag] };
    const court = { ...need(uniqueName("court scale")), searchWords: [tag] };

    vi.mocked(matchLessonIcons).mockImplementation(async ({ needs }) => ({
      data: needs.map((item) =>
        item.need.name === justice.name || item.need.name === court.name ? scale.id : coin.id,
      ),
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    }));

    const picked = await pickLessonIcons({
      requests: [
        { forIdea: true, need: coins, usedFor: "the lesson map's idea: interest" },
        { forIdea: true, need: need(coin.name), usedFor: "the lesson map's idea: compounding" },
        { forIdea: false, need: purse, usedFor: "a screen" },
        { forIdea: true, need: justice, usedFor: "the lesson map's idea: courts" },
        { forIdea: true, need: court, usedFor: "the lesson map's idea: appeals" },
      ],
    });

    expect(picked.map(({ iconId, name }) => ({ iconId, name }))).toStrictEqual([
      { iconId: null, name: coins.name },
      { iconId: coin.id, name: coin.name },
      { iconId: coin.id, name: purse.name },
      { iconId: scale.id, name: justice.name },
      { iconId: null, name: court.name },
    ]);
  });

  it("links a name another lesson is still drawing and skips one that failed, without paying for either", async () => {
    const [drawing, failed] = await Promise.all([
      lessonIconFixture({ name: uniqueName("map"), smallUrl: null, status: "running", url: null }),
      lessonIconFixture({
        name: uniqueName("compass"),
        smallUrl: null,
        status: "failed",
        url: null,
      }),
    ]);

    await expect(
      pickLessonIcons({
        requests: [
          { forIdea: false, need: need(drawing.name), usedFor: "a screen" },
          { forIdea: false, need: need(failed.name), usedFor: "a screen" },
        ],
      }),
    ).resolves.toStrictEqual([
      { iconId: drawing.id, name: drawing.name, need: need(drawing.name) },
    ]);

    expect(matchLessonIcons).not.toHaveBeenCalled();
  });
});

describe(linkLessonIcons, () => {
  it("links each icon, drawn or still drawing, to every screen and idea that asked for it and stops waiting for the others", async () => {
    const [cloud, nucleus] = [uniqueName("electron cloud"), uniqueName("atom")];
    taggedAs({ cloud, nucleus });

    const { lesson } = await playableLessonFixture({
      lesson: { summary: { ideas, shape: "hub" } },
      steps: ["explanation", "explanation"],
    });

    await tagLessonMarks({ lessonId: lesson.id });

    const drawing = await lessonIconFixture({
      name: cloud,
      smallUrl: null,
      status: "running",
      url: null,
    });

    await linkLessonIcons({
      lessonId: lesson.id,
      picked: [
        { iconId: drawing.id, name: cloud },
        { iconId: null, name: nucleus },
      ],
    });

    const { ideas: saved, steps } = await readMarks(lesson.id);

    expect(steps.map((step) => step.marks)).toMatchObject([
      { iconId: drawing.id, iconPending: false },
      { iconId: drawing.id, iconPending: false },
    ]);

    expect(saved.map(({ iconId, iconPending }) => ({ iconId, iconPending }))).toStrictEqual([
      { iconId: drawing.id, iconPending: false },
      { iconId: null, iconPending: false },
    ]);
  });
});

describe(readLessonMarking, () => {
  it("waits for tagging and for an icon still being drawn, but not for one stuck past the picture wait", async () => {
    const marks = {
      example: null,
      iconId: null,
      iconPending: false,
      ideaIndex: null,
      underline: null,
    };

    const unfinished = { smallUrl: null, status: "running", url: null } as const;

    const [drawing, stuck] = await Promise.all([
      lessonIconFixture(unfinished),
      lessonIconFixture({ ...unfinished, createdAt: new Date(Date.now() - 10 * 60_000) }),
    ]);

    const lessons = await Promise.all([
      playableLessonFixture({ steps: ["explanation"] }),
      playableLessonFixture({
        steps: [{ kind: "explanation", marks: { ...marks, iconId: drawing.id } }],
      }),
      playableLessonFixture({
        lesson: { summary: { ideas: [{ iconId: stuck.id, text: "Electrons live in clouds." }] } },
        steps: [{ kind: "explanation", marks }],
      }),
    ]);

    await expect(
      Promise.all(lessons.map(({ lesson }) => readLessonMarking(lesson.id))),
    ).resolves.toStrictEqual([
      { drawingIcons: false, tagged: false },
      { drawingIcons: true, tagged: true },
      { drawingIcons: false, tagged: true },
    ]);
  });
});
