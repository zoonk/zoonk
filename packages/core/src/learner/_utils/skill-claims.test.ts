import { describe, expect, it } from "vitest";
import {
  type ClaimEvent,
  listAnsweredWrong,
  listKnownSkills,
  listTakenToKnow,
  meetsKnownBar,
  readSkillClaims,
} from "./skill-claims";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 8, 12, minute));

const test = (minute: number, isCorrect: boolean, skillId = "organelles"): ClaimEvent => ({
  at: at(minute),
  isCorrect,
  kind: "test",
  skillId,
});

const practice = (minute: number, isCorrect: boolean, skillId = "organelles"): ClaimEvent => ({
  at: at(minute),
  isCorrect,
  kind: "practice",
  skillId,
});

const claim = (minute: number, skillId = "organelles"): ClaimEvent => ({
  at: at(minute),
  kind: "claim",
  skillId,
});

const trueFalse = (minute: number, skillId = "organelles"): ClaimEvent => ({
  at: at(minute),
  isCorrect: true,
  kind: "test",
  skillId,
  trueFalse: true,
});

const undone = (minute: number, skillId = "organelles"): ClaimEvent => ({
  at: at(minute),
  kind: "undone",
  skillId,
});

const studied = (minute: number, skillId = "organelles"): ClaimEvent => ({
  at: at(minute),
  kind: "studied",
  skillId,
});

describe(readSkillClaims, () => {
  it("takes one right test answer as a claim that practice still has to confirm", () => {
    expect(readSkillClaims([test(1, true)]).get("organelles")).toBe("toConfirm");
  });

  it("confirms a claim with a right answer in practice", () => {
    expect(readSkillClaims([test(1, true), practice(2, true)]).get("organelles")).toBe("confirmed");
  });

  it("makes a claim missed in practice a gap, whatever comes after in practice", () => {
    const claims = readSkillClaims([test(1, true), practice(2, false), practice(3, true)]);
    expect(claims.get("organelles")).toBe("gap");
  });

  it("makes a confirmed claim a gap when practice misses it before the learner studied it", () => {
    const claims = readSkillClaims([claim(1), practice(2, true), practice(3, false)]);
    expect(claims.get("organelles")).toBe("gap");
  });

  it("keeps a missed test answer a gap until a right test answer claims the skill again", () => {
    expect(readSkillClaims([test(1, false), practice(2, true)]).get("organelles")).toBe("gap");
    expect(readSkillClaims([test(1, false), test(2, true)]).get("organelles")).toBe("toConfirm");
  });

  it("claims what a test-out skipped, and never takes back a confirmation", () => {
    expect(readSkillClaims([claim(1)]).get("organelles")).toBe("toConfirm");

    const confirmed = readSkillClaims([test(1, true), practice(2, true), claim(3), test(4, true)]);
    expect(confirmed.get("organelles")).toBe("confirmed");
  });

  it("says nothing of skills practiced without a claim, and reads events in time order", () => {
    const claims = readSkillClaims([
      practice(3, true, "membrane"),
      practice(2, false),
      test(1, true),
    ]);

    expect(claims.has("membrane")).toBe(false);
    expect(claims.get("organelles")).toBe("gap");
  });

  it("takes nothing on trust once the learner studied the skill's lessons", () => {
    const claims = readSkillClaims([studied(1), test(2, true), practice(3, false)]);
    expect(claims.get("organelles")).toBe("confirmed");

    expect(readSkillClaims([test(1, true), studied(2)]).get("organelles")).toBe("confirmed");
    expect(readSkillClaims([studied(1), test(2, false)]).get("organelles")).toBe("gap");
    expect(readSkillClaims([test(1, false), studied(2)]).get("organelles")).toBe("gap");
  });
});

describe(listTakenToKnow, () => {
  it("lists skills taken to know without studying them, confirmed by practice or not", () => {
    const events = [
      claim(1, "membrane"),
      test(1, true, "nucleus"),
      practice(2, true, "nucleus"),
      test(1, true, "virus"),
      practice(2, false, "virus"),
      studied(1),
      test(2, true),
    ];

    expect(listTakenToKnow(events)).toStrictEqual(new Set(["membrane", "nucleus"]));
  });
});

describe(listAnsweredWrong, () => {
  it("lists a skill missed once, whatever came after", () => {
    const events = [test(1, true), test(2, false), test(3, true), test(4, true, "membrane")];

    expect(listAnsweredWrong(events)).toStrictEqual(new Set(["organelles"]));
  });

  it("lists a skill missed in practice", () => {
    expect(listAnsweredWrong([studied(1), practice(2, false)])).toStrictEqual(
      new Set(["organelles"]),
    );
  });
});

describe(meetsKnownBar, () => {
  const right = { isCorrect: true, trueFalse: false };
  const rightTrueFalse = { isCorrect: true, trueFalse: true };
  const wrong = { isCorrect: false, trueFalse: false };

  it("takes one right answer as known, two when the learner focused on it", () => {
    expect(meetsKnownBar({ answers: [right], focused: false })).toBe(true);
    expect(meetsKnownBar({ answers: [right], focused: true })).toBe(false);
    expect(meetsKnownBar({ answers: [right, right], focused: true })).toBe(true);
  });

  it("takes true-or-false answers as known only three right at a time", () => {
    expect(meetsKnownBar({ answers: [rightTrueFalse, rightTrueFalse], focused: false })).toBe(
      false,
    );

    expect(
      meetsKnownBar({ answers: [rightTrueFalse, rightTrueFalse, rightTrueFalse], focused: true }),
    ).toBe(true);
  });

  it("never takes a skill with a miss as known", () => {
    expect(meetsKnownBar({ answers: [wrong, right, right], focused: false })).toBe(false);
  });
});

describe(listKnownSkills, () => {
  it("keeps a skill to confirm, not known, after one right true-or-false answer", () => {
    const events = [trueFalse(1)];

    expect(readSkillClaims(events).get("organelles")).toBe("toConfirm");
    expect(listKnownSkills({ events })).toStrictEqual(new Set());
  });

  it("knows a skill from three right true-or-false answers of its own", () => {
    expect(listKnownSkills({ events: [trueFalse(1), trueFalse(2), trueFalse(3)] })).toStrictEqual(
      new Set(["organelles"]),
    );
  });

  it("knows a skill from one right answer that isn't true or false, two when focused", () => {
    expect(listKnownSkills({ events: [test(1, true)] })).toStrictEqual(new Set(["organelles"]));

    expect(listKnownSkills({ events: [test(1, true)], focused: () => true })).toStrictEqual(
      new Set(),
    );

    expect(
      listKnownSkills({ events: [test(1, true), practice(2, true)], focused: () => true }),
    ).toStrictEqual(new Set(["organelles"]));
  });

  it("knows a skill a test-out skipped or the learner studied, never a gap or one missed", () => {
    const events = [
      claim(1, "tested"),
      studied(1, "studied"),
      test(1, false, "gap"),
      test(1, false, "missed"),
      test(2, true, "missed"),
    ];

    expect(listKnownSkills({ events })).toStrictEqual(new Set(["studied", "tested"]));
  });

  it("doesn't know a skill whose test-out the learner undid until a later answer of its own", () => {
    expect(listKnownSkills({ events: [test(1, true), claim(2), undone(2)] })).toStrictEqual(
      new Set(),
    );

    expect(
      listKnownSkills({ events: [test(1, true), claim(2), undone(2), test(3, true)] }),
    ).toStrictEqual(new Set(["organelles"]));
  });

  it("doesn't know a skill passed over by choice that practice hasn't confirmed", () => {
    const events = [claim(1, "skipped"), claim(1, "confirmed"), practice(2, true, "confirmed")];

    expect(listKnownSkills({ events, passedOver: () => true })).toStrictEqual(
      new Set(["confirmed"]),
    );
  });
});
