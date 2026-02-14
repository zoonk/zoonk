import { describe, expect, it } from "vitest";
import { isUsernameAllowed } from "./username-validator";

describe(isUsernameAllowed, () => {
  describe("reserved usernames", () => {
    it("blocks exact reserved names", () => {
      expect(isUsernameAllowed("admin")).toBeFalsy();
      expect(isUsernameAllowed("root")).toBeFalsy();
      expect(isUsernameAllowed("support")).toBeFalsy();
      expect(isUsernameAllowed("api")).toBeFalsy();
    });

    it("blocks reserved names case-insensitively", () => {
      expect(isUsernameAllowed("Admin")).toBeFalsy();
      expect(isUsernameAllowed("ADMIN")).toBeFalsy();
      expect(isUsernameAllowed("Root")).toBeFalsy();
    });

    it("blocks Zoonk-specific routes", () => {
      expect(isUsernameAllowed("courses")).toBeFalsy();
      expect(isUsernameAllowed("login")).toBeFalsy();
      expect(isUsernameAllowed("auth")).toBeFalsy();
      expect(isUsernameAllowed("profile")).toBeFalsy();
    });

    it("blocks Zoonk product names", () => {
      expect(isUsernameAllowed("zoonk")).toBeFalsy();
      expect(isUsernameAllowed("school")).toBeFalsy();
      expect(isUsernameAllowed("team")).toBeFalsy();
    });

    it("blocks infrastructure subdomains", () => {
      expect(isUsernameAllowed("smtp")).toBeFalsy();
      expect(isUsernameAllowed("ftp")).toBeFalsy();
      expect(isUsernameAllowed("mail")).toBeFalsy();
      expect(isUsernameAllowed("www")).toBeFalsy();
    });
  });

  describe("valid usernames", () => {
    it("allows common names", () => {
      expect(isUsernameAllowed("johndoe")).toBeTruthy();
      expect(isUsernameAllowed("alice_bob")).toBeTruthy();
      expect(isUsernameAllowed("sarah42")).toBeTruthy();
      expect(isUsernameAllowed("marcos")).toBeTruthy();
      expect(isUsernameAllowed("pierre")).toBeTruthy();
    });

    it("allows usernames with numbers and special chars", () => {
      expect(isUsernameAllowed("user123")).toBeTruthy();
      expect(isUsernameAllowed("dev.ops")).toBeTruthy();
      expect(isUsernameAllowed("j_smith")).toBeTruthy();
    });

    it("allows usernames that contain reserved words as substrings", () => {
      expect(isUsernameAllowed("myadmin2")).toBeTruthy();
      expect(isUsernameAllowed("superdog")).toBeTruthy();
    });
  });
});
