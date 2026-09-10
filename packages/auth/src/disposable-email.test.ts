import mailchecker from "mailchecker";
import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "./disposable-email";

describe(isDisposableEmail, () => {
  it.each([
    "learner@mailinator.com",
    "learner@MAILINATOR.COM",
    "learner@inbox.mailinator.com",
    "learner@yopmail.com",
    "learner@10minutemail.com",
  ])("blocks a temporary inbox: %s", (email) => {
    expect(isDisposableEmail(email)).toBe(true);
  });

  it.each([
    "learner@gmail.com",
    "learner+course@gmail.com",
    "learner@proton.me",
    "learner@mailinator.com.example.org",
    "learner@mailinatorcompany.com",
    "learner@learner.anonaddy.com",
    "learner@relay.firefox.com",
    "learner@aleeas.com",
    "learner@33mail.com",
  ])("allows a regular mailbox or privacy alias: %s", (email) => {
    expect(isDisposableEmail(email)).toBe(false);
  });

  it.each(["icloud.com", "privaterelay.appleid.com", "private.icloud.com"])(
    "keeps Apple %s allowed even if an upstream update lists it",
    (domain) => {
      const domains = mailchecker.blacklist();
      const wasListed = domains.has(domain);
      domains.add(domain);

      try {
        expect(isDisposableEmail(`learner@${domain}`)).toBe(false);
      } finally {
        if (!wasListed) {
          domains.delete(domain);
        }
      }
    },
  );

  it("does not let an Apple-looking subdomain bypass a disposable parent domain", () => {
    expect(isDisposableEmail("learner@icloud.com.mailinator.com")).toBe(true);
  });
});
