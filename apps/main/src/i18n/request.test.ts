import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import createPoCodec from "@eloqnt/format-po";
import compile from "icu-minify/compile";
import { createFormatter, createTranslator } from "next-intl";
import { type GetRequestConfigParams, type RequestConfig } from "next-intl/server";
import { lang } from "next/root-params";
import { describe, expect, it, vi } from "vitest";
import { getPathname } from "./navigation";
import requestConfig from "./request";

// The server entry point requires React's server condition; its config wrapper only returns this callback.
vi.mock("next-intl/server", () => ({
  getRequestConfig: (callback: (params: GetRequestConfigParams) => Promise<RequestConfig>) =>
    callback,
}));

vi.mock("next/root-params", () => ({ lang: vi.fn() }));

vi.mock("./messages", () => ({ getAllMessages: (locale: string) => catalogMessages(locale) }));

function catalogMessage({ catalog, id, locale }: { catalog: string; id: string; locale: string }) {
  const file = resolve(import.meta.dirname, catalog, `${locale}.po`);

  const entries = createPoCodec().decode(readFileSync(file, "utf8"), {
    locale,
    sourceLocale: "en",
  });

  const entry = entries.find((message) => message.id === id);

  if (!entry) {
    throw new Error(`Missing catalog message ${id} in ${file}`);
  }

  return compile(entry.message);
}

function catalogMessages(locale: string) {
  return {
    learnNumber: catalogMessage({
      catalog: "../../../../packages/learn/messages",
      id: "dVwB3J",
      locale,
    }),
    learnPlural: catalogMessage({
      catalog: "../../../../packages/learn/messages",
      id: "npC_pq",
      locale,
    }),
    mainNumber: catalogMessage({ catalog: "../../messages", id: "wieA_m", locale }),
    mainPlural: catalogMessage({ catalog: "../../messages", id: "ArogzQ", locale }),
  };
}

async function config(locale?: string) {
  vi.mocked(lang).mockResolvedValue("es");
  const params = { locale, requestLocale: Promise.resolve(locale) };
  const settings = await requestConfig(params);

  return { locale: settings.locale, messages: settings.messages ?? undefined };
}

describe("catalog formatting", () => {
  it.each([
    [1.5, "1.5"],
    [1000, "1,000"],
    [1234.56, "1,234.56"],
    [10_000, "10,000"],
    [12_345.67, "12,345.67"],
  ])("uses Mexican Spanish for ICU numbers and plural # at %s", async (value, formatted) => {
    const settings = await config();
    const t = createTranslator({ ...settings, timeZone: "UTC" });

    expect(t("mainNumber", { week: value })).toBe(`semana ${formatted}`);

    expect(t("mainPlural", { count: value, total: value })).toBe(
      `${formatted} lecciones de ${formatted}`,
    );

    expect(t("learnNumber", { done: value, total: value })).toBe(`${formatted} de ${formatted}`);

    expect(t("learnPlural", { done: value, total: value })).toBe(
      `${formatted} de ${formatted} lecciones completadas`,
    );

    expect(createFormatter(settings).number(value)).toBe(formatted);
  });

  it("keeps explicit and message dates on the same Mexican locale", async () => {
    const settings = await config("es");
    const date = new Date("2026-09-27T14:30:00Z");

    const t = createTranslator({
      ...settings,
      messages: { time: compile("{value, time, ::hm}") },
      timeZone: "UTC",
    });

    expect(t("time", { value: date })).toBe("2:30 p.m.");

    expect(
      createFormatter({ ...settings, timeZone: "UTC" }).dateTime(date, { timeStyle: "short" }),
    ).toBe("2:30 p.m.");
  });

  it.each([1.5, 1234.56, 12_345.67])("preserves English formatting at %s", async (value) => {
    const t = createTranslator(await config("en"));
    const formatted = new Intl.NumberFormat("en").format(value);

    expect(t("mainNumber", { week: value })).toBe(`week ${formatted}`);

    expect(t("mainPlural", { count: value, total: value })).toBe(
      `${formatted} of ${formatted} lessons`,
    );

    expect(t("learnNumber", { done: value, total: value })).toBe(`${formatted} of ${formatted}`);
  });

  it("keeps public URLs on the language code", () => {
    expect(getPathname({ href: "/plan", locale: "es-MX" })).toBe("/es/plan");
    expect(getPathname({ href: "/plan", locale: "es" })).toBe("/es/plan");
    expect(getPathname({ href: "/plan", locale: "en" })).toBe("/plan");
  });
});
