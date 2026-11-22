import { describe, expect, it } from "vitest";
import { selectOutlineChapters } from "./select-outline-chapters";

const PLAN = {
  extensions: [{ skill: { key: "interview" } }],
  isNewBand: false,
  otherChapterTitles: ["Candidaturas e entrevistas"],
};

const REPEATED = { skillKeys: ["interview"], title: "CANDIDATURAS E ENTREVISTAS" };
const UNTAGGED = { skillKeys: [], title: "Entrevistas" };

describe(selectOutlineChapters, () => {
  it("discards every chapter when an existing band gets only a repeated title and an untagged chapter", () => {
    expect(selectOutlineChapters({ chapters: [REPEATED, UNTAGGED], plan: PLAN })).toStrictEqual([]);
  });

  it("keeps new teaching chapters and only one continuation for one extension", () => {
    const continuation = { skillKeys: ["interview"], title: "Descrever experiências" };
    const extra = { skillKeys: ["interview"], title: "Mais entrevistas" };
    const teaching = { skillKeys: ["work"], title: "Conversas no trabalho" };

    expect(
      selectOutlineChapters({ chapters: [REPEATED, continuation, extra, teaching], plan: PLAN }),
    ).toStrictEqual([continuation, teaching]);
  });

  it("keeps the same chapters when opening a new band", () => {
    const chapters = [REPEATED, UNTAGGED];

    expect(selectOutlineChapters({ chapters, plan: { ...PLAN, isNewBand: true } })).toStrictEqual(
      chapters,
    );
  });
});
