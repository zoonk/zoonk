import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const androidFiles = [
  "core/designsystem/src/main/kotlin/com/zoonk/android/ui/theme/ZoonkPalette.kt",
  "core/resources/src/main/res/values/window_colors.xml",
  "core/resources/src/main/res/values-night/window_colors.xml",
];

const applePalette = "Zoonk/Resources/Assets.xcassets/Palette";

function contents(root: string): Record<string, string> {
  const files = readdirSync(root, { recursive: true, withFileTypes: true });

  return Object.fromEntries(
    files
      .filter((file) => file.isFile())
      .map((file) => {
        const path = join(file.parentPath, file.name);
        return [relative(root, path), readFileSync(path, "utf8")];
      }),
  );
}

describe("native palette generation", () => {
  it("keeps both platforms' committed palettes up to date with globals.css", () => {
    const output = mkdtempSync(join(tmpdir(), "zoonk-palette-"));

    try {
      const android = join(output, "android");
      const apple = join(output, "apple");

      execFileSync(process.execPath, [
        join(repoRoot, "apps/android/scripts/theme/generate-palette.mts"),
        android,
      ]);

      execFileSync(process.execPath, [
        join(repoRoot, "apps/apple/scripts/generate-palette.mts"),
        apple,
      ]);

      for (const file of androidFiles) {
        expect(readFileSync(join(android, file), "utf8")).toBe(
          readFileSync(join(repoRoot, "apps/android", file), "utf8"),
        );
      }

      expect(contents(join(apple, applePalette))).toStrictEqual(
        contents(join(repoRoot, "apps/apple", applePalette)),
      );
    } finally {
      rmSync(output, { force: true, recursive: true });
    }
  });
});
