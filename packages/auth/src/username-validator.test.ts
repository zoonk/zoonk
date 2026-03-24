import { describe, expect, it } from "vitest";
import { isUsernameAllowed } from "./username-validator";

describe(isUsernameAllowed, () => {
  describe("reserved usernames", () => {
    it("blocks exact reserved names", () => {
      expect(isUsernameAllowed("admin")).toBe(false);
      expect(isUsernameAllowed("root")).toBe(false);
      expect(isUsernameAllowed("support")).toBe(false);
      expect(isUsernameAllowed("api")).toBe(false);
    });

    it("blocks reserved names case-insensitively", () => {
      expect(isUsernameAllowed("Admin")).toBe(false);
      expect(isUsernameAllowed("ADMIN")).toBe(false);
      expect(isUsernameAllowed("Root")).toBe(false);
    });

    it("blocks Zoonk-specific routes", () => {
      expect(isUsernameAllowed("courses")).toBe(false);
      expect(isUsernameAllowed("login")).toBe(false);
      expect(isUsernameAllowed("auth")).toBe(false);
      expect(isUsernameAllowed("profile")).toBe(false);
    });

    it("blocks Zoonk product names", () => {
      expect(isUsernameAllowed("zoonk")).toBe(false);
      expect(isUsernameAllowed("school")).toBe(false);
      expect(isUsernameAllowed("team")).toBe(false);
    });

    it("blocks infrastructure subdomains", () => {
      expect(isUsernameAllowed("smtp")).toBe(false);
      expect(isUsernameAllowed("ftp")).toBe(false);
      expect(isUsernameAllowed("mail")).toBe(false);
      expect(isUsernameAllowed("www")).toBe(false);
    });
  });

  describe("invalid characters", () => {
    it("blocks usernames containing dots", () => {
      expect(isUsernameAllowed("dev.ops")).toBe(false);
      expect(isUsernameAllowed("john.doe")).toBe(false);
      expect(isUsernameAllowed(".leading")).toBe(false);
      expect(isUsernameAllowed("trailing.")).toBe(false);
    });
  });

  describe("valid usernames", () => {
    it("allows common names", () => {
      expect(isUsernameAllowed("johndoe")).toBe(true);
      expect(isUsernameAllowed("alice_bob")).toBe(true);
      expect(isUsernameAllowed("sarah42")).toBe(true);
      expect(isUsernameAllowed("marcos")).toBe(true);
      expect(isUsernameAllowed("pierre")).toBe(true);
    });

    it("allows usernames with numbers and underscores", () => {
      expect(isUsernameAllowed("user123")).toBe(true);
      expect(isUsernameAllowed("j_smith")).toBe(true);
    });

    it("allows usernames that contain reserved words as substrings", () => {
      expect(isUsernameAllowed("myadmin2")).toBe(true);
      expect(isUsernameAllowed("superdog")).toBe(true);
    });
  });
});
