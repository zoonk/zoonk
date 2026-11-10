import { type ProfileQuestionView } from "@zoonk/core/profile/questions/contract";
import { describe, expect, it } from "vitest";
import {
  type ProfileDraft,
  canSendProfileDraft,
  getPrecheckedSupports,
  toProfileAnswer,
  toProfileDraft,
  toggleProfileExclusive,
  toggleProfilePick,
  withPrecheckedSupports,
} from "./profile-draft";

function draft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return { consented: false, exclusive: null, picks: [], studies: [], text: "", ...overrides };
}

function view(overrides: Partial<ProfileQuestionView> & Pick<ProfileQuestionView, "id">) {
  return {
    options: [],
    saved: { picks: [], studies: [], text: "" },
    status: null,
    version: 1,
    ...overrides,
  } satisfies ProfileQuestionView;
}

describe(toggleProfilePick, () => {
  it("a fourth chip is refused and says so", () => {
    const full = draft({ picks: ["sports", "anime", "drama"] });
    const result = toggleProfilePick({ draft: full, id: "comedy", question: "watch" });

    expect(result).toStrictEqual({ capped: true, draft: full });
  });

  it("a pick clears an exclusive row", () => {
    const result = toggleProfilePick({
      draft: draft({ exclusive: "none" }),
      id: "excel",
      question: "tools",
    });

    expect(result.draft).toStrictEqual(draft({ picks: ["excel"] }));
  });

  it("work keeps one status", () => {
    const result = toggleProfilePick({
      draft: draft({ picks: ["student"] }),
      id: "work",
      question: "work",
    });

    expect(result.draft.picks).toStrictEqual(["work"]);
  });

  it("studies keep their pick order and cap at three", () => {
    let current = draft();

    for (const field of ["law", "media", "health"]) {
      current = toggleProfilePick({ draft: current, id: field, question: "studies" }).draft;
    }

    expect(current.studies.map((study) => study.field)).toStrictEqual(["law", "media", "health"]);

    expect(toggleProfilePick({ draft: current, id: "other", question: "studies" }).capped).toBe(
      true,
    );
  });

  it("condition rows have no cap, and removing the last one drops consent", () => {
    const picked = toggleProfilePick({
      draft: draft({ consented: true, picks: ["adhd", "autism", "dyslexia"] }),
      id: "anxiety",
      question: "conditions",
    });

    expect(picked).toStrictEqual({
      capped: false,
      draft: draft({ consented: true, picks: ["adhd", "autism", "dyslexia", "anxiety"] }),
    });

    const cleared = toggleProfilePick({
      draft: draft({ consented: true, picks: ["adhd"] }),
      id: "adhd",
      question: "conditions",
    });

    expect(cleared.draft.consented).toBe(false);
  });
});

describe(toggleProfileExclusive, () => {
  it("clears everything else, and toggles off", () => {
    const picked = toggleProfileExclusive({
      draft: draft({ consented: true, picks: ["adhd"], text: "note" }),
      exclusive: "ratherNot",
    });

    expect(picked).toStrictEqual(draft({ exclusive: "ratherNot" }));

    expect(toggleProfileExclusive({ draft: picked, exclusive: "ratherNot" })).toStrictEqual(
      draft(),
    );
  });
});

describe(canSendProfileDraft, () => {
  it("onboarding needs an answer", () => {
    expect(canSendProfileDraft({ draft: draft(), from: "onboarding", question: "watch" })).toBe(
      false,
    );

    expect(
      canSendProfileDraft({ draft: draft({ text: "Dune" }), from: "onboarding", question: "read" }),
    ).toBe(true);
  });

  it("Settings saves an empty screen", () => {
    expect(canSendProfileDraft({ draft: draft(), from: "settings", question: "watch" })).toBe(true);
  });

  it("another field needs its name", () => {
    const other = draft({ studies: [{ field: "other", subject: " " }] });

    expect(canSendProfileDraft({ draft: other, from: "onboarding", question: "studies" })).toBe(
      false,
    );
  });

  it("Settings refuses unconsented conditions, onboarding sends them as declined", () => {
    const picked = draft({ picks: ["adhd"] });

    expect(canSendProfileDraft({ draft: picked, from: "settings", question: "conditions" })).toBe(
      false,
    );

    expect(canSendProfileDraft({ draft: picked, from: "onboarding", question: "conditions" })).toBe(
      true,
    );
  });
});

describe(toProfileAnswer, () => {
  it("unconsented conditions send only a decline", () => {
    expect(
      toProfileAnswer({
        draft: draft({ picks: ["adhd", "other"], text: "Migraines" }),
        memoryEnabled: true,
        question: "conditions",
      }),
    ).toStrictEqual({
      answer: { conditions: [], consented: false, declined: true },
      question: "conditions",
    });
  });

  it("consented conditions keep the note only on other", () => {
    expect(
      toProfileAnswer({
        draft: draft({ consented: true, picks: ["adhd", "other"], text: " Migraines " }),
        memoryEnabled: true,
        question: "conditions",
      }),
    ).toStrictEqual({
      answer: {
        conditions: [
          { condition: "adhd", note: null },
          { condition: "other", note: "Migraines" },
        ],
        consented: true,
        declined: false,
      },
      question: "conditions",
    });
  });

  it("the job goes only with a working status", () => {
    expect(
      toProfileAnswer({
        draft: draft({ picks: ["student"], text: "nurse" }),
        memoryEnabled: true,
        question: "work",
      })?.answer,
    ).toStrictEqual({ declined: false, job: null, status: "student" });
  });

  it("No sound effects alone is an answer", () => {
    expect(
      toProfileAnswer({
        draft: draft({ picks: ["noSoundEffects"] }),
        memoryEnabled: true,
        question: "learningSupport",
      })?.answer,
    ).toStrictEqual({ declined: false, needs: [], note: null, soundEffects: false });
  });

  it("Nothing in particular declines and turns sounds back on", () => {
    expect(
      toProfileAnswer({
        draft: draft({ exclusive: "nothingInParticular" }),
        memoryEnabled: true,
        question: "learningSupport",
      })?.answer,
    ).toStrictEqual({ declined: true, needs: [], note: null, soundEffects: true });
  });

  it("with memory off, the support note isn't sent", () => {
    expect(
      toProfileAnswer({
        draft: draft({ picks: ["stepByStep"], text: "Diagrams" }),
        memoryEnabled: false,
        question: "learningSupport",
      })?.answer,
    ).toStrictEqual({ declined: false, needs: ["stepByStep"], note: null, soundEffects: true });
  });

  it("an empty screen declines", () => {
    expect(
      toProfileAnswer({ draft: draft(), memoryEnabled: true, question: "studies" })?.answer,
    ).toStrictEqual({ declined: true, studies: [] });
  });

  it("studies send their subjects", () => {
    expect(
      toProfileAnswer({
        draft: draft({ studies: [{ field: "media", subject: "journalism" }] }),
        memoryEnabled: true,
        question: "studies",
      })?.answer,
    ).toStrictEqual({ declined: false, studies: [{ field: "media", subject: "journalism" }] });
  });
});

describe(toProfileDraft, () => {
  it("a declined question shows its exclusive row", () => {
    expect(toProfileDraft(view({ id: "watch", status: "declined" }))).toStrictEqual(
      draft({ exclusive: "none" }),
    );
  });

  it("saved answers fill the screen, and saved conditions keep their consent", () => {
    expect(
      toProfileDraft(
        view({
          id: "conditions",
          saved: { picks: ["other"], studies: [], text: "Migraines" },
          status: "answered",
        }),
      ),
    ).toStrictEqual(draft({ consented: true, picks: ["other"], text: "Migraines" }));
  });

  it("a sound-only decline shows No sound effects, not the exclusive row", () => {
    expect(
      toProfileDraft(
        view({
          id: "learningSupport",
          saved: { picks: ["noSoundEffects"], studies: [], text: "" },
          status: "declined",
        }),
      ),
    ).toStrictEqual(draft({ picks: ["noSoundEffects"] }));
  });
});

describe(getPrecheckedSupports, () => {
  it("merges the supports of every picked condition", () => {
    expect(getPrecheckedSupports(["adhd", "autism", "motor"])).toStrictEqual([
      "stepByStep",
      "shortAnswers",
      "shorterDays",
      "plainWords",
      "noSoundEffects",
    ]);
  });
});

describe(withPrecheckedSupports, () => {
  it("adds the suggestions to what the learner already turned on", () => {
    expect(
      withPrecheckedSupports({ conditions: ["adhd"], draft: draft({ picks: ["noSoundEffects"] }) })
        .picks,
    ).toStrictEqual(["noSoundEffects", "stepByStep", "shortAnswers", "shorterDays"]);
  });
});
