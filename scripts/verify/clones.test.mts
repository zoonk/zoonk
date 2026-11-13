import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { auditClones } from "./clones.mts";
import { type ChangedFile } from "./diff-audit.mts";

const NOTICE = [
  "export function SignInAgain() {",
  "  const t = useTranslations();",
  "  return (",
  '    <div className="flex flex-col items-start gap-2" role="alert">',
  '      <p className="text-sm">{t("For your safety, sign in again.")}</p>',
  "      <CurrentPageLoginLink",
  '        className={buttonVariants({ size: "sm", variant: "outline" })}',
  '        icon={<LogInIcon aria-hidden="true" />}',
  "      >",
  '        {t("Sign in again")}',
  "      </CurrentPageLoginLink>",
  "    </div>",
  "  );",
  "}",
].join("\n");

const SHORT_LINES = 4;
const LAST_LINE = 15;

const IMPORTS = Array.from(
  { length: 12 },
  (_, index) => `import { piece${index}, other${index} } from "@zoonk/ui/piece-${index}";`,
).join("\n");

function added(path: string, source: string, lines?: number[]): ChangedFile {
  return {
    added: (lines ?? source.split("\n").map((_, index) => index + 1)).map((line) => ({
      line,
      text: source.split("\n")[line - 1] ?? "",
    })),
    created: lines === undefined,
    path,
  };
}

function audit(files: ChangedFile[], sources: Record<string, string>) {
  return auditClones(files, Object.keys(sources), (path) => sources[path] ?? "");
}

describe("finding near-duplicate code", () => {
  it("lists the existing copy of an added block, whatever its spacing and comments", () => {
    const sources = {
      "apps/main/src/profile/delete-account.tsx": NOTICE,
      "apps/main/src/profile/passkeys.tsx": `// The passkey list.\n${NOTICE.replaceAll("  ", "    ")}`,
    };

    const flags = audit(
      [added("apps/main/src/profile/passkeys.tsx", sources["apps/main/src/profile/passkeys.tsx"])],
      sources,
    );

    assert.equal(flags.length, 1);
    assert.equal(flags[0]?.path, "apps/main/src/profile/passkeys.tsx");
    assert.match(flags[0]?.rule.question ?? "", /delete-account\.tsx:1-14/u);
  });

  it("reports two added copies of each other once, so parallel work is caught when combined", () => {
    const sources = {
      "packages/learn/src/memory/memory-row.tsx": NOTICE,
      "packages/player/src/mind-maps/menu.tsx": NOTICE,
    };

    const flags = audit(
      Object.entries(sources).map(([path, source]) => added(path, source)),
      sources,
    );

    assert.equal(flags.length, 1);
  });

  it("ignores blocks the change didn't touch, short repeats, imports and scaffolding", () => {
    const short = NOTICE.split("\n").slice(0, SHORT_LINES).join("\n");

    const sources = {
      "apps/main/src/a.tsx": `${IMPORTS}\n${short}\nexport const a = 1;`,
      "apps/main/src/b.tsx": `${IMPORTS}\n${short}\nexport const b = 2;`,
      "apps/main/src/c.tsx": `${NOTICE}\nexport const c = 3;`,
      "apps/main/src/d.tsx": NOTICE,
      "packages/ai/src/tasks/one/one.ts": NOTICE,
      "packages/ai/src/tasks/two/two.ts": NOTICE,
    };

    assert.deepEqual(
      audit(
        [
          added("apps/main/src/a.tsx", sources["apps/main/src/a.tsx"]),
          added("apps/main/src/c.tsx", sources["apps/main/src/c.tsx"], [LAST_LINE]),
          added("packages/ai/src/tasks/two/two.ts", NOTICE),
        ],
        sources,
      ),
      [],
    );
  });
});
