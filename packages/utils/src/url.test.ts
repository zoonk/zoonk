import { describe, expect, it } from "vitest";
import { isCorsAllowedOrigin } from "./url";

describe(isCorsAllowedOrigin, () => {
  describe("zoonk domains", () => {
    it("allows https://zoonk.com", () => {
      expect(isCorsAllowedOrigin("https://zoonk.com")).toBeTruthy();
    });

    it("allows subdomains of zoonk.com", () => {
      expect(isCorsAllowedOrigin("https://api.zoonk.com")).toBeTruthy();
      expect(isCorsAllowedOrigin("https://www.zoonk.com")).toBeTruthy();
      expect(isCorsAllowedOrigin("https://app.zoonk.com")).toBeTruthy();
    });

    it("allows zoonk.app and subdomains", () => {
      expect(isCorsAllowedOrigin("https://zoonk.app")).toBeTruthy();
      expect(isCorsAllowedOrigin("https://api.zoonk.app")).toBeTruthy();
    });

    it("allows zoonk.school and subdomains", () => {
      expect(isCorsAllowedOrigin("https://zoonk.school")).toBeTruthy();
      expect(isCorsAllowedOrigin("https://learn.zoonk.school")).toBeTruthy();
    });

    it("allows zoonk.team and subdomains", () => {
      expect(isCorsAllowedOrigin("https://zoonk.team")).toBeTruthy();
      expect(isCorsAllowedOrigin("https://dev.zoonk.team")).toBeTruthy();
    });

    it("rejects non-zoonk domains", () => {
      expect(isCorsAllowedOrigin("https://evil.com")).toBeFalsy();
      expect(isCorsAllowedOrigin("https://notzoonk.com")).toBeFalsy();
      expect(isCorsAllowedOrigin("https://zoonk.com.evil.com")).toBeFalsy();
    });

    it("rejects http for zoonk domains", () => {
      expect(isCorsAllowedOrigin("http://zoonk.com")).toBeFalsy();
      expect(isCorsAllowedOrigin("http://api.zoonk.com")).toBeFalsy();
    });
  });

  describe("localhost", () => {
    it("allows any localhost port", () => {
      expect(isCorsAllowedOrigin("http://localhost:3000")).toBeTruthy();
      expect(isCorsAllowedOrigin("http://localhost:3005")).toBeTruthy();
      expect(isCorsAllowedOrigin("http://localhost:8080")).toBeTruthy();
      expect(isCorsAllowedOrigin("http://localhost:65527")).toBeTruthy();
    });

    it("rejects https localhost", () => {
      expect(isCorsAllowedOrigin("https://localhost:3000")).toBeFalsy();
    });

    it("rejects localhost without port", () => {
      expect(isCorsAllowedOrigin("http://localhost")).toBeFalsy();
    });
  });

  describe("vercel previews", () => {
    it("allows vercel preview deployments when not in production", () => {
      expect(isCorsAllowedOrigin("https://my-branch-zoonk.vercel.app")).toBeTruthy();
      expect(isCorsAllowedOrigin("https://feature-123-zoonk.vercel.app")).toBeTruthy();
    });

    it("rejects vercel apps that don't end with -zoonk", () => {
      expect(isCorsAllowedOrigin("https://other-project.vercel.app")).toBeFalsy();
      expect(isCorsAllowedOrigin("https://zoonk.vercel.app")).toBeFalsy();
    });
  });

  describe("rejected origins", () => {
    it("rejects random external domains", () => {
      expect(isCorsAllowedOrigin("https://google.com")).toBeFalsy();
      expect(isCorsAllowedOrigin("https://evil-site.com")).toBeFalsy();
    });

    it("rejects domains that look similar but are not zoonk", () => {
      expect(isCorsAllowedOrigin("https://fakezoonk.com")).toBeFalsy();
      expect(isCorsAllowedOrigin("https://zoonk-fake.com")).toBeFalsy();
    });
  });
});
