import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type ChangedFile } from "./diff-audit.mts";
import { auditRepeatedWords, auditRestatedClasses, featureOf } from "./repeated-literals.mts";

const THEME = "packages/ui/src/styles/globals.css";
const TASK_LAYOUT = "packages/learn/src/_components/task-layout.tsx";
const CATALOG = "packages/learn/messages/en.po";

function added(path: string, source: string): ChangedFile {
  return {
    added: source.split("\n").map((text, index) => ({ line: index + 1, text })),
    created: true,
    path,
  };
}

function entry(text: string, sources: string[]): string {
  return [
    ...sources.map((source) => `#: ${source}`),
    `msgid ${JSON.stringify(text)}`,
    `msgstr ""`,
    "",
  ].join("\n");
}

describe("finding class lists that restate a shared piece", () => {
  const sources: Record<string, string> = {
    [TASK_LAYOUT]:
      'export const TASK_COLUMN_CLASS = "max-w-column mx-auto flex w-full flex-1 flex-col px-4";\nexport const ROW_MARK_CLASS = "flex size-4 shrink-0 items-center justify-center";',
    [THEME]: "@theme inline {\n  --container-column: 40rem;\n  --radius-lg: 1rem;\n}",
  };

  function audit(path: string, source: string) {
    return auditRestatedClasses([added(path, source)], [...Object.keys(sources), path], (file) =>
      file === path ? source : (sources[file] ?? ""),
    );
  }

  it("names the constant a new class list restates", () => {
    const flags = audit(
      "packages/player/src/mind-maps/slides.tsx",
      'export const Slides = () => <div className="max-w-column mx-auto grid w-full flex-1 flex-col gap-6 px-4 flex" />;',
    );

    assert.equal(flags.length, 1);
    assert.match(flags[0]?.rule.question ?? "", /TASK_COLUMN_CLASS/u);
  });

  it("ignores constants made only of layout idioms, and lists that use the constant", () => {
    assert.deepEqual(
      audit(
        "packages/learn/src/week/marks.tsx",
        'const a = <span className="text-muted-foreground flex size-4 shrink-0 items-center justify-center" />;\nconst b = <div className={cn(TASK_COLUMN_CLASS, "gap-8 py-12")} />;',
      ),
      [],
    );
  });
});

describe("finding words another feature already says", () => {
  const sentence = "Your starting point is set";

  const sources: Record<string, string> = {
    [CATALOG]: [
      entry(sentence, ["src/onboarding/steps/placement-screens.tsx"]),
      entry("Only on this page", ["src/focus-test/focus-test-intro.tsx"]),
    ].join("\n"),
  };

  function audit(files: [string, string][]) {
    const all = { ...sources, ...Object.fromEntries(files) };

    return auditRepeatedWords(
      files.map(([path, source]) => added(path, source)),
      Object.keys(all),
      (path) => all[path] ?? "",
    );
  }

  it("points at the other feature's screen once per sentence", () => {
    const result = `const title = t(${JSON.stringify(sentence)});\nconst again = t(${JSON.stringify(sentence)});`;
    const flags = audit([["packages/learn/src/focus-test/focus-test-result.tsx", result]]);

    assert.equal(flags.length, 1);
    assert.match(flags[0]?.rule.question ?? "", /onboarding\/steps\/placement-screens\.tsx/u);
    assert.equal(flags[0]?.sample, sentence);
  });

  it("ignores short labels, the same feature, and text that isn't a catalog message", () => {
    assert.deepEqual(
      audit([
        [
          "packages/learn/src/focus-test/focus-test-intro.tsx",
          't("Only on this page");\nt({ description: "Your starting point is set, as a heading", message: "Set" });',
        ],
        [
          "packages/learn/src/onboarding/steps/placement-done.tsx",
          `t(${JSON.stringify(sentence)});`,
        ],
      ]),
      [],
    );
  });

  it("groups app routes by their first real segment and packages by their first folder", () => {
    assert.equal(
      featureOf("apps/main/src/app/[lang]/(app)/(settings)/profile/passkey-list.tsx"),
      "apps/main/src/profile",
    );

    assert.equal(
      featureOf("packages/learn/src/session/question-block/x.tsx"),
      "packages/learn/src/session",
    );

    assert.equal(featureOf("packages/learn/src/index.ts"), "packages/learn");
  });
});
