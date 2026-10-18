import { describe, expect, it } from "vitest";
import { mergeMessages } from "./merge-messages";

describe(mergeMessages, () => {
  it("lets a later catalog win a key collision", () => {
    expect(
      mergeMessages(
        { login: "Package", logout: "Only package" },
        { help: "Only app", login: "App" },
      ),
    ).toStrictEqual({ help: "Only app", login: "App", logout: "Only package" });
  });

  it("keeps an earlier translation when the later catalog's message is still empty", () => {
    expect(mergeMessages({ login: "Entrar" }, { login: "" })).toStrictEqual({ login: "Entrar" });
  });

  it("keeps an empty message when no catalog has a translation", () => {
    expect(mergeMessages({ login: "" }, { logout: "" })).toStrictEqual({ login: "", logout: "" });
  });

  it("lets a translation replace an earlier empty message", () => {
    expect(mergeMessages({ login: "" }, { login: "Entrar" })).toStrictEqual({ login: "Entrar" });
  });

  it("merges namespaces key by key", () => {
    expect(
      mergeMessages(
        { feedback: { login: "Package", logout: "Only package" }, title: "Title" },
        { feedback: { help: "Only app", login: "App", logout: "" } },
      ),
    ).toStrictEqual({
      feedback: { help: "Only app", login: "App", logout: "Only package" },
      title: "Title",
    });
  });

  it("treats precompiled messages as whole messages", () => {
    expect(
      mergeMessages({ greeting: ["Oi ", ["name"]] }, { greeting: ["Olá ", ["name"]] }),
    ).toStrictEqual({ greeting: ["Olá ", ["name"]] });
  });

  it("merges more than two catalogs in order", () => {
    expect(mergeMessages({ login: "Player" }, { login: "Learn" }, { login: "" })).toStrictEqual({
      login: "Learn",
    });
  });
});
