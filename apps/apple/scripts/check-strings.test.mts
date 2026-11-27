import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PREVIOUS_BUILD = new Date("2026-01-01T00:00:00Z");
const SOURCE_EDIT = new Date("2026-01-02T00:00:00Z");
const CURRENT_BUILD = new Date("2026-01-03T00:00:00Z");

function checkCatalogs(objectTime: Date, hasExtraction = true) {
  const fixture = mkdtempSync(path.join(tmpdir(), "zoonk-catalog-check-"));

  try {
    const scripts = path.join(fixture, "scripts");
    const source = path.join(fixture, "Zoonk", "Note.swift");

    const objects = path.join(
      fixture,
      "DerivedData/Make/Build/Intermediates.noindex/Zoonk.build/Debug-maccatalyst/Zoonk.build/Objects-normal/arm64",
    );

    const file = path.join(objects, "Note.stringsdata");
    const object = path.join(objects, "Note.o");
    const check = path.join(scripts, "check-strings.mts");

    mkdirSync(scripts);
    mkdirSync(path.dirname(source));
    mkdirSync(objects, { recursive: true });
    copyFileSync(path.join(import.meta.dirname, "check-strings.mts"), check);
    writeFileSync(source, "let count = 2\n");
    utimesSync(source, SOURCE_EDIT, SOURCE_EDIT);
    writeFileSync(object, "");
    utimesSync(object, objectTime, objectTime);

    if (hasExtraction) {
      writeFileSync(file, JSON.stringify({ source, tables: {}, version: 1 }));
      utimesSync(file, PREVIOUS_BUILD, PREVIOUS_BUILD);
    }

    return spawnSync(process.execPath, [check], { encoding: "utf8" });
  } finally {
    rmSync(fixture, { force: true, recursive: true });
  }
}

describe("compiled String Catalog freshness", () => {
  it("accepts unchanged extraction when its Swift file was rebuilt", () => {
    const result = checkCatalogs(CURRENT_BUILD);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("requires a build of the latest source edit", () => {
    const result = checkCatalogs(PREVIOUS_BUILD);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing current string extraction for 1 Swift files");
  });

  it("requires extraction alongside the compiled object", () => {
    const result = checkCatalogs(CURRENT_BUILD, false);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing current string extraction for 1 Swift files");
  });
});
