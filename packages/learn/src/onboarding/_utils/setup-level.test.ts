import { describe, expect, it } from "vitest";
import { readSetupLevel } from "./setup-level";

describe(readSetupLevel, () => {
  it("shows a level test's result over every other answer", () => {
    expect(
      readSetupLevel({ answered: ["level"], level: "B1+", levelNote: "a little" }),
    ).toStrictEqual({ kind: "tested", text: "B1+" });
  });

  it("shows the level the learner picked over what their words said", () => {
    expect(readSetupLevel({ answered: ["level"], level: "none", levelNote: "A2" })).toStrictEqual({
      kind: "own",
      level: "none",
    });
  });

  it("shows the learner's own words when they weren't asked, then the level read from them", () => {
    expect(readSetupLevel({ level: "intermediate", levelNote: "B1" })).toStrictEqual({
      kind: "words",
      text: "B1",
    });

    expect(readSetupLevel({ level: "basic" })).toStrictEqual({ kind: "own", level: "basic" });
  });

  it("shows nothing while a quick test chosen in place of a level hasn't given one", () => {
    expect(readSetupLevel({ answered: ["level"] })).toBeNull();
  });
});
