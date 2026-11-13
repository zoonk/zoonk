import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterAll, describe, it } from "vitest";

const repository = resolve(import.meta.dirname, "../..");
const folder = mkdtempSync(join(tmpdir(), "zoonk-lint-"));

afterAll(() => {
  rmSync(folder, { force: true, recursive: true });
});

function lint(rule: string, files: Record<string, string>): string[] {
  const here = mkdtempSync(join(folder, `${rule}-`));
  const config = join(here, "oxlintrc.json");

  writeFileSync(
    config,
    JSON.stringify({
      categories: { correctness: "off" },
      jsPlugins: [join(repository, "packages/oxlint-plugin/index.js")],
      plugins: [],
      rules: { [`zoonk/${rule}`]: "error" },
    }),
  );

  for (const [name, source] of Object.entries(files)) {
    writeFileSync(join(here, name), source);
  }

  const { stdout } = spawnSync(
    join(repository, "node_modules/.bin/oxlint"),
    ["-c", config, "-f", "unix", here],
    { encoding: "utf8" },
  );

  return stdout
    .split("\n")
    .flatMap((line) => {
      const report = /^(?<path>[^:]+):(?<line>\d+):\d+: /u.exec(line)?.groups;
      return report ? [`${basename(report.path ?? "")}:${report.line ?? ""}`] : [];
    })
    .toSorted();
}

describe("one glyph on a button (zoonk/one-glyph-button)", () => {
  it("reports a button with a second glyph, and an arrow on any control", () => {
    assert.deepEqual(
      lint("one-glyph-button", {
        "bad.tsx": [
          "export const A = <Button><PlayIcon />{t('Play')}<ShortcutKbd>⏎</ShortcutKbd></Button>;",
          "export const B = <Link className={buttonVariants()}>{t('Go')}<ArrowRightIcon /></Link>;",
          "export const C = <TaskMainLink icon={<ArrowLeftIcon />}>{t('Back')}</TaskMainLink>;",
          "export const D = { icon: <ArrowRightIcon /> };",
        ].join("\n"),
        "good.tsx": [
          "export const A = <Button>{t('Start')}{busy ? <Spinner /> : <ShortcutKbd>⏎</ShortcutKbd>}</Button>;",
          "export const B = <Button><CalendarIcon />{label}<ChevronDownIcon /></Button>;",
          "export const C = <ListRowButton><BookIcon />{t('Lessons')}<ChevronRightIcon /></ListRowButton>;",
          "export const D = <h2><ArrowRightIcon />{t('What you will learn')}</h2>;",
          "export const E = <button className='ring-input'><SearchIcon />{t('Search')}<Kbd>K</Kbd></button>;",
          "export const F = <Button><span><ZapIcon />{energy}</span><span><FlameIcon />{days}</span></Button>;",
        ].join("\n"),
      }),
      ["bad.tsx:1", "bad.tsx:2", "bad.tsx:3", "bad.tsx:4"],
    );
  });
});

describe("shared-piece source checks", () => {
  it("reports an icon button pulled to an edge by hand", () => {
    assert.deepEqual(
      lint("no-hand-placed-icon-button", {
        "bad.tsx": [
          'export const A = <Button className="-ml-2" size="icon"><XIcon /></Button>;',
          'export const B = <Button className={cn("sm:-mr-2", x)}><XIcon /></Button>;',
          "export const C = <TaskHeader className={TASK_HEADER_ICON_CLASS} />;",
        ].join("\n"),
        "good.tsx": [
          'export const A = <Button edge="start" size="icon"><XIcon /></Button>;',
          'export const B = <Button className="-ml-2">{t("Back")}</Button>;',
        ].join("\n"),
      }),
      ["bad.tsx:1", "bad.tsx:2", "bad.tsx:3"],
    );
  });

  it("reports a fold drawn by hand", () => {
    assert.deepEqual(
      lint("no-hand-made-fold", {
        "bad.tsx": [
          'export const A = "h-(--collapsible-panel-height)";',
          "export const B = <CollapsibleTrigger>{t('More')}<ChevronDownIcon /></CollapsibleTrigger>;",
        ].join("\n"),
        "good.tsx":
          "export const A = <CollapsibleTrigger>{t('More')}<FoldChevron /></CollapsibleTrigger>;",
      }),
      ["bad.tsx:1", "bad.tsx:2"],
    );
  });

  it("reports a second answer option", () => {
    assert.deepEqual(
      lint("one-answer-option", {
        "bad.tsx":
          'export const ANSWER_OPTION_CLASS = "rounded-lg";\nexport function AnswerOptionContent() {}',
        "good.tsx":
          'const ANSWER_OPTION_CLASS = "rounded-lg";\nexport const X = ANSWER_OPTION_CLASS;',
      }),
      ["bad.tsx:1", "bad.tsx:2"],
    );
  });

  it("reports a question's actions drawn outside their piece", () => {
    assert.deepEqual(
      lint("one-question-action-bar", {
        "bad.tsx": [
          "export const A = <ShortcutKbd>⏎</ShortcutKbd>;",
          'export const B = t("I don\'t know yet");',
          "export const C = t({ message: \"I don't know yet\", description: 'x' });",
        ].join("\n"),
        "good.tsx": "export const A = <ShortcutKbd>F</ShortcutKbd>;\nexport const B = t('I know');",
      }),
      ["bad.tsx:1", "bad.tsx:2", "bad.tsx:3"],
    );
  });

  it("reports a question's title drawn outside its piece", () => {
    assert.deepEqual(
      lint("one-question-title", {
        "bad.tsx":
          'import { QUESTION_TEXT_CLASS } from "./question-title";\nexport const A = QUESTION_TEXT_CLASS;',
        "good.tsx": "export const A = <QuestionTitle>{text}</QuestionTitle>;",
      }),
      ["bad.tsx:1", "bad.tsx:2"],
    );
  });
});

describe("interface convention source checks", () => {
  it("reports a hand-drawn back glyph without changing other import restrictions", () => {
    assert.deepEqual(
      lint("one-back-link", {
        "bad.tsx": 'import { ArrowLeftIcon as Back, ChevronLeftIcon } from "lucide-react";',
        "good.tsx":
          'import { ChevronRightIcon } from "lucide-react";\nimport { BackLink } from "@zoonk/ui/components/page-top";',
      }),
      ["bad.tsx:1", "bad.tsx:1"],
    );
  });

  it("reports only a badge whose only content is Plus", () => {
    assert.deepEqual(
      lint("no-plus-badge", {
        "bad.tsx": [
          "export const A = <Badge>Plus</Badge>;",
          'export const B = <LabelChip>{t("Plus")}</LabelChip>;',
          'export const C = <PlusMark>{"Plus"}</PlusMark>;',
          'export const D = <Badge>{t({message: "Plus", description: "plan"})}</Badge>;',
        ].join("\n"),
        "good.tsx": [
          "export const A = <Badge>Plus sign</Badge>;",
          "export const B = <p>Plus</p>;",
          "export const C = <Badge><PlusIcon />{count}</Badge>;",
          "export const D = <Badge>{planName}</Badge>;",
        ].join("\n"),
      }),
      ["bad.tsx:1", "bad.tsx:2", "bad.tsx:3", "bad.tsx:4"],
    );
  });

  it("reports page-root and first-child top spacing without policing inner sections", () => {
    assert.deepEqual(
      lint("no-page-top-spacing", {
        "bad.tsx": [
          'export const A = <Page className="pt-4" />;',
          'export const B = <DetailLayout className={cn("md:py-8", extra)} />;',
          'export const C = <Page><header className="-mt-2" /></Page>;',
          'export const D = <PageTop className="sm:mt-3" />;',
        ].join("\n"),
        "good.tsx": [
          'export const A = <Page className="pb-8"><header /><section className="pt-4" /></Page>;',
          'export const B = <Page><header><div className="pt-4" /></header></Page>;',
          'export const C = <TaskFrame className="pt-4" />;',
        ].join("\n"),
      }),
      ["bad.tsx:1", "bad.tsx:2", "bad.tsx:3", "bad.tsx:4"],
    );
  });

  it("reports centered dialog imports while retaining full-screen and alert pieces", () => {
    assert.deepEqual(
      lint("one-overlay-piece", {
        "bad.tsx": [
          'import { DialogContent as Content } from "@zoonk/ui/components/dialog";',
          'import { DialogHeader, DialogFooter } from "./dialog";',
        ].join("\n"),
        "good.tsx": [
          'import { DialogPopup } from "@zoonk/ui/components/dialog";',
          'import { AlertDialog } from "@zoonk/ui/components/alert-dialog";',
          'import { Drawer } from "@zoonk/ui/components/drawer";',
          'import { DialogContent } from "some-other-library";',
        ].join("\n"),
      }),
      ["bad.tsx:1", "bad.tsx:2", "bad.tsx:2"],
    );
  });

  it("reports the legacy eyebrow pieces", () => {
    assert.deepEqual(
      lint("one-eyebrow", {
        "bad.tsx": "export const A = <PageEyebrow />;\nexport const B = <DetailEyebrow />;",
        "good.tsx": "export const A = <Eyebrow />;\nexport const B = <PageTitle />;",
      }),
      ["bad.tsx:1", "bad.tsx:2"],
    );
  });
});
