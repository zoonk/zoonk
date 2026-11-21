import {
  MAX_PROFILE_JOB_LENGTH,
  type ProfileQuestionView,
} from "@zoonk/core/profile/questions/contract";
import { assert, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type ProfileDraft,
  type ProfileQuestionPlace,
  getPrecheckedSupports,
  getProfileJobPrefill,
  toProfileDraft,
  toProfileInput,
  toggleProfileExclusive,
  toggleProfilePick,
  withPrecheckedSupports,
} from "./profile-draft";

function draft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return { exclusive: null, picks: [], studies: [], text: "", typed: [], ...overrides };
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

function input({
  draft: sent,
  from = "onboarding",
  memoryEnabled = true,
  question,
  status = null,
}: {
  draft: ProfileDraft;
  from?: ProfileQuestionPlace;
  memoryEnabled?: boolean;
  question: ProfileQuestionView["id"];
  status?: ProfileQuestionView["status"];
}) {
  return toProfileInput({
    draft: sent,
    from,
    memoryEnabled,
    question: view({ id: question, status }),
  });
}

describe(getProfileJobPrefill, () => {
  it("an earlier role fits the job field and can be sent without editing", () => {
    const role =
      "  Senior software engineer responsible for infrastructure, operations, and deployment  ";

    const text = getProfileJobPrefill(role);
    expect(text).toBe(role.trim().slice(0, MAX_PROFILE_JOB_LENGTH));

    expect(
      input({ draft: draft({ picks: ["work"], text: text ?? "" }), question: "work" }),
    ).not.toBeNull();
  });

  it("every earlier role produces a sendable work answer", () => {
    assert(
      property(string({ maxLength: 200, minLength: MAX_PROFILE_JOB_LENGTH }), (role) => {
        const text = getProfileJobPrefill(role);
        expect(text?.length ?? 0).toBeLessThanOrEqual(MAX_PROFILE_JOB_LENGTH);

        expect(
          input({ draft: draft({ picks: ["work"], text: text ?? "" }), question: "work" }),
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
  it("a pick clears the decline row", () => {
    const result = toggleProfilePick({
      draft: draft({ exclusive: "ratherNot" }),
      id: "student",
      question: "work",
    });

    expect(result).toStrictEqual(draft({ picks: ["student"] }));
  });

  it("work keeps one status", () => {
    const result = toggleProfilePick({
      draft: draft({ picks: ["student"] }),
      id: "work",
      question: "work",
    });

    expect(result.picks).toStrictEqual(["work"]);
  });

  it("studies keep their pick order, however many there are", () => {
    let current = draft();

    for (const field of ["law", "media", "health", "other"]) {
      current = toggleProfilePick({ draft: current, id: field, question: "studies" });
    }

    expect(current.studies.map((study) => study.field)).toStrictEqual([
      "law",
      "media",
      "health",
      "other",
    ]);
  });

  it("chips have no cap", () => {
    const picked = toggleProfilePick({
      draft: draft({ picks: ["sports", "anime", "drama"] }),
      id: "comedy",
      question: "watch",
    });

    expect(picked).toStrictEqual(draft({ picks: ["sports", "anime", "drama", "comedy"] }));
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

describe(toProfileInput, () => {
  it("onboarding needs an answer", () => {
    expect(input({ draft: draft(), question: "watch" })).toBeNull();
    expect(input({ draft: draft({ text: "Dune" }), question: "read" })).not.toBeNull();
  });

  it("Settings needs an answer for an unanswered question", () => {
    expect(input({ draft: draft(), from: "settings", question: "watch" })).toBeNull();
  });

  it("Settings lets the learner clear a saved answer", () => {
    expect(
      input({ draft: draft(), from: "settings", question: "watch", status: "answered" }),
    ).not.toBeNull();
  });

  it("Settings lets the learner explicitly decline an unanswered question", () => {
    expect(
      input({ draft: draft({ exclusive: "ratherNot" }), from: "settings", question: "work" }),
    ).not.toBeNull();
  });

  it("another field needs its name", () => {
    const other = draft({ studies: [{ field: "other", subject: " " }] });

    expect(input({ draft: other, question: "studies" })).toBeNull();
  });

  it("Something else needs its words, in onboarding and Settings", () => {
    const blank = draft({ picks: ["adhd", "other"], text: " " });
    const filled = draft({ picks: ["adhd", "other"], text: "Migraines" });

    for (const from of ["onboarding", "settings"] as const) {
      expect(input({ draft: blank, from, question: "conditions" })).toBeNull();
      expect(input({ draft: filled, from, question: "conditions" })).not.toBeNull();
    }
  });

  it("an emptied conditions screen declines", () => {
    expect(
      input({ draft: draft(), from: "settings", question: "conditions", status: "answered" }),
    ).toStrictEqual({
      answer: { conditions: [], consented: false, declined: true },
      question: "conditions",
    });
  });

  it("picked conditions are saved with consent, the note only on other", () => {
    expect(
      input({
        draft: draft({ picks: ["adhd", "other"], text: " Migraines " }),
        from: "settings",
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
      draft: toggleProfilePick({ draft: draft(), id: "feminine", question: "addressForm" }),
      id: "neutral",
      question: "addressForm",
    });

    expect(input({ draft: picked, memoryEnabled: false, question: "addressForm" })).toStrictEqual({
      answer: { declined: false, form: "neutral" },
      question: "addressForm",
    });

    expect(
      input({
        draft: toggleProfileExclusive({ draft: picked, exclusive: "ratherNot" }),
        question: "addressForm",
      }),
    ).toStrictEqual({ answer: { declined: true, form: null }, question: "addressForm" });
  });

  it("the job goes only with a working status", () => {
    expect(
      input({ draft: draft({ picks: ["student"], text: "nurse" }), question: "work" })?.answer,
    ).toStrictEqual({ declined: false, job: null, status: "student" });
  });

  it("No sound effects alone is an answer", () => {
    expect(
      input({ draft: draft({ picks: ["noSoundEffects"] }), question: "learningSupport" })?.answer,
    ).toStrictEqual({ declined: false, needs: [], note: null, soundEffects: false });
  });

  it("an emptied support screen declines and turns sounds back on", () => {
    expect(
      input({ draft: draft(), from: "settings", question: "learningSupport", status: "answered" })
        ?.answer,
    ).toStrictEqual({ declined: true, needs: [], note: null, soundEffects: true });
  });

  it("with memory off, the support note isn't sent", () => {
    expect(
      input({
        draft: draft({ picks: ["stepByStep"], text: "Diagrams" }),
        memoryEnabled: false,
        question: "learningSupport",
      })?.answer,
    ).toStrictEqual({ declined: false, needs: ["stepByStep"], note: null, soundEffects: true });
  });

  it("an emptied screen declines", () => {
    expect(
      input({ draft: draft(), from: "settings", question: "studies", status: "answered" })?.answer,
    ).toStrictEqual({ declined: true, studies: [] });
  });

  it("studies send their subjects", () => {
    expect(
      input({
        draft: draft({ studies: [{ field: "media", subject: "journalism" }] }),
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

const TOOLS = [
  { description: null, id: "excel", label: "Excel" },
  { description: null, id: "Tasy", label: "Tasy" },
];

describe("the tools question", () => {
  const tools = view({ id: "tools", options: TOOLS });

  it("text left in the tools field is saved with the typed tools", () => {
    expect(
      toProfileInput({
        draft: draft({ picks: ["Tasy"], text: "Excel, UpToDate", typed: ["Whitebook"] }),
        from: "onboarding",
        memoryEnabled: true,
        question: tools,
      }),
    ).toStrictEqual({
      answer: { declined: false, favorites: "Whitebook, UpToDate", picks: ["Tasy", "excel"] },
      question: "tools",
    });
  });

  it("a name that doesn't fit holds the screen until the learner makes room", () => {
    expect(
      toProfileInput({
        draft: draft({ picks: ["Tasy"], text: "Python", typed: ["a".repeat(118)] }),
        from: "onboarding",
        memoryEnabled: true,
        question: tools,
      }),
    ).toBeNull();
  });

  it("onboarding can't send a tools screen with nothing on it", () => {
    expect(
      toProfileInput({
        draft: draft({ text: " , " }),
        from: "onboarding",
        memoryEnabled: true,
        question: tools,
      }),
    ).toBeNull();
  });

  it("saved typed tools come back as chips", () => {
    expect(
      toProfileDraft(
        view({
          id: "tools",
          saved: { picks: [], studies: [], text: "ClinicalKey, Whitebook" },
          status: "answered",
        }),
      ),
    ).toStrictEqual(draft({ typed: ["ClinicalKey", "Whitebook"] }));
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
