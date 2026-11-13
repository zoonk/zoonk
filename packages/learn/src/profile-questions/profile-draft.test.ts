import {
  MAX_PROFILE_JOB_LENGTH,
  type ProfileQuestionView,
} from "@zoonk/core/profile/questions/contract";
import { assert, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type ProfileDraft,
  canSendProfileDraft,
  getPrecheckedSupports,
  getProfileJobPrefill,
  toProfileAnswer,
  toProfileDraft,
  toggleProfileExclusive,
  toggleProfilePick,
  withPrecheckedSupports,
} from "./profile-draft";

function draft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return { exclusive: null, picks: [], studies: [], text: "", ...overrides };
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

describe(getProfileJobPrefill, () => {
  it("an earlier role fits the job field and can be sent without editing", () => {
    const role =
      "  Senior software engineer responsible for infrastructure, operations, and deployment  ";

    const text = getProfileJobPrefill(role);
    expect(text).toBe(role.trim().slice(0, MAX_PROFILE_JOB_LENGTH));

    expect(
      toProfileAnswer({
        draft: draft({ picks: ["work"], text: text ?? "" }),
        memoryEnabled: true,
        question: "work",
      }),
    ).not.toBeNull();
  });

  it("every earlier role produces a sendable work answer", () => {
    assert(
      property(string({ maxLength: 200, minLength: MAX_PROFILE_JOB_LENGTH }), (role) => {
        const text = getProfileJobPrefill(role);
        expect(text?.length ?? 0).toBeLessThanOrEqual(MAX_PROFILE_JOB_LENGTH);

        expect(
          toProfileAnswer({
            draft: draft({ picks: ["work"], text: text ?? "" }),
            memoryEnabled: true,
            question: "work",
          }),
        ).not.toBeNull();
      }),
    );
  });

  it("no earlier role leaves the optional job empty", () => {
    expect(getProfileJobPrefill(null)).toBeNull();
    expect(getProfileJobPrefill(" \n ")).toBeNull();
  });
});

describe(toggleProfilePick, () => {
  it("a fourth chip is refused and says so", () => {
    const full = draft({ picks: ["sports", "anime", "drama"] });
    const result = toggleProfilePick({ draft: full, id: "comedy", question: "watch" });

    expect(result).toStrictEqual({ capped: true, draft: full });
  });

  it("a pick clears the decline row", () => {
    const result = toggleProfilePick({
      draft: draft({ exclusive: "ratherNot" }),
      id: "student",
      question: "work",
    });

    expect(result.draft).toStrictEqual(draft({ picks: ["student"] }));
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

  it("condition rows have no cap", () => {
    const picked = toggleProfilePick({
      draft: draft({ picks: ["adhd", "autism", "dyslexia"] }),
      id: "anxiety",
      question: "conditions",
    });

    expect(picked).toStrictEqual({
      capped: false,
      draft: draft({ picks: ["adhd", "autism", "dyslexia", "anxiety"] }),
    });
  });
});

describe(toggleProfileExclusive, () => {
  it("clears everything else, and toggles off", () => {
    const picked = toggleProfileExclusive({
      draft: draft({ picks: ["student"], text: "note" }),
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

  it("Something else needs its words, in onboarding and Settings", () => {
    const blank = draft({ picks: ["adhd", "other"], text: " " });
    const filled = draft({ picks: ["adhd", "other"], text: "Migraines" });

    for (const from of ["onboarding", "settings"] as const) {
      expect(canSendProfileDraft({ draft: blank, from, question: "conditions" })).toBe(false);
      expect(canSendProfileDraft({ draft: filled, from, question: "conditions" })).toBe(true);
    }
  });

  it("Settings saves picked conditions", () => {
    expect(
      canSendProfileDraft({
        draft: draft({ picks: ["adhd"] }),
        from: "settings",
        question: "conditions",
      }),
    ).toBe(true);
  });
});

describe(toProfileAnswer, () => {
  it("an empty conditions screen declines", () => {
    expect(
      toProfileAnswer({ draft: draft(), memoryEnabled: true, question: "conditions" }),
    ).toStrictEqual({
      answer: { conditions: [], consented: false, declined: true },
      question: "conditions",
    });
  });

  it("picked conditions are saved with consent, the note only on other", () => {
    expect(
      toProfileAnswer({
        draft: draft({ picks: ["adhd", "other"], text: " Migraines " }),
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

  it("the address form sends one form, and I'd rather not say declines it", () => {
    const picked = toggleProfilePick({
      draft: toggleProfilePick({ draft: draft(), id: "feminine", question: "addressForm" }).draft,
      id: "neutral",
      question: "addressForm",
    }).draft;

    expect(
      toProfileAnswer({ draft: picked, memoryEnabled: false, question: "addressForm" }),
    ).toStrictEqual({ answer: { declined: false, form: "neutral" }, question: "addressForm" });

    expect(
      toProfileAnswer({
        draft: toggleProfileExclusive({ draft: picked, exclusive: "ratherNot" }),
        memoryEnabled: true,
        question: "addressForm",
      }),
    ).toStrictEqual({ answer: { declined: true, form: null }, question: "addressForm" });
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

  it("an empty support screen declines and turns sounds back on", () => {
    expect(
      toProfileAnswer({
        draft: draft(),
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
  it("a declined pick-one question shows its decline row", () => {
    expect(toProfileDraft(view({ id: "addressForm", status: "declined" }))).toStrictEqual(
      draft({ exclusive: "ratherNot" }),
    );
  });

  it("a declined question with several picks shows nothing picked", () => {
    expect(toProfileDraft(view({ id: "watch", status: "declined" }))).toStrictEqual(draft());
  });

  it("saved answers fill the screen", () => {
    expect(
      toProfileDraft(
        view({
          id: "conditions",
          saved: { picks: ["other"], studies: [], text: "Migraines" },
          status: "answered",
        }),
      ),
    ).toStrictEqual(draft({ picks: ["other"], text: "Migraines" }));
  });

  it("declined conditions show nothing picked, since the screen has no decline row", () => {
    expect(toProfileDraft(view({ id: "conditions", status: "declined" }))).toStrictEqual(draft());
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
