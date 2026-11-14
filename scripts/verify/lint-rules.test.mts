/* oxlint-disable no-magic-numbers -- Expected locations are fixture source line numbers. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";

const repository = resolve(import.meta.dirname, "../..");
const folder = mkdtempSync(join(tmpdir(), "zoonk-lint-"));

const FIXTURES = [
  {
    bad: [
      'export const A = <div role="dialog" />;',
      'export const B = <section role={"alertdialog"} />;',
    ],
    good: [
      'export const A = <section role="region" />;',
      "export const B = <DrawerPopup />;",
      "export const C = <div role={role} />;",
    ],
    rule: "no-hand-made-panel",
    skipped: {
      "fixture.test.tsx": 'export const A = <div role="alertdialog" />;',
      "packages/ui/owned.tsx": 'export const A = <div role="dialog" />;',
    },
  },
  {
    bad: [
      "export const A = <Button><PlayIcon />{t('Play')}<ShortcutKbd>⏎</ShortcutKbd></Button>;",
      "export const B = <Link className={buttonVariants()}>{t('Go')}<ArrowRightIcon /></Link>;",
      "export const C = <TaskMainLink icon={<ArrowLeftIcon />}>{t('Back')}</TaskMainLink>;",
      "export const D = { icon: <ArrowRightIcon /> };",
    ],
    good: [
      "export const A = <Button>{t('Start')}{busy ? <Spinner /> : <ShortcutKbd>⏎</ShortcutKbd>}</Button>;",
      "export const B = <Button><CalendarIcon />{label}<ChevronDownIcon /></Button>;",
      "export const C = <ListRowButton><BookIcon />{t('Lessons')}<ChevronRightIcon /></ListRowButton>;",
      "export const D = <h2><ArrowRightIcon />{t('What you will learn')}</h2>;",
      "export const E = <button className='ring-input'><SearchIcon />{t('Search')}<Kbd>K</Kbd></button>;",
      "export const F = <Button><span><ZapIcon />{energy}</span><span><FlameIcon />{days}</span></Button>;",
      'import { ChevronLeftIcon } from "lucide-react"; export const G = <Button><ChevronLeftIcon />Previous</Button>;',
    ],
    rule: "one-glyph-button",
  },
  {
    bad: [
      'export const A = <Button className="-ml-2" size="icon"><XIcon /></Button>;',
      'export const B = <Button className={cn("sm:-mr-2", x)}><XIcon /></Button>;',
    ],
    good: [
      'export const A = <Button edge="start" size="icon"><XIcon /></Button>;',
      'export const B = <Button className="-ml-2">{t("Back")}</Button>;',
    ],
    rule: "no-hand-placed-icon-button",
  },
  {
    bad: [
      'export const A = "h-(--collapsible-panel-height)";',
      "export const B = <CollapsibleTrigger>{t('More')}<ChevronDownIcon /></CollapsibleTrigger>;",
    ],
    good: ["export const A = <CollapsibleTrigger>{t('More')}<FoldChevron /></CollapsibleTrigger>;"],
    rule: "no-hand-made-fold",
  },
  {
    bad: ['export const ANSWER_OPTION_CLASS = "rounded-lg";'],
    good: ['const ANSWER_OPTION_CLASS = "rounded-lg"; export const A = ANSWER_OPTION_CLASS;'],
    rule: "one-answer-option",
  },
  {
    bad: [
      'export const B = <Button>{t("I don\'t know yet")}</Button>;',
      'export const C = <button>{t({ message: "I don\'t know yet", description: "x" })}</button>;',
    ],
    good: [
      "export const A = <ShortcutKbd>⏎</ShortcutKbd>;",
      'export const B = { label: t("I don\'t know yet") };',
      'export const C = <p>{t("I don\'t know yet")}</p>;',
    ],
    rule: "one-question-action-bar",
  },
  {
    bad: [
      "export const A = <Badge>Plus</Badge>;",
      'export const B = <FactChip>{t("Plus")}</FactChip>;',
      'export const C = <ProfileChip><PlusIcon /><span>{"Plus"}</span></ProfileChip>;',
      'export const D = <Badge>{t({message: "Plus", description: "plan"})}</Badge>;',
    ],
    good: [
      "export const A = <Badge>Plus sign</Badge>;",
      "export const B = <p>Plus</p>;",
      "export const C = <Badge><PlusIcon />{count}</Badge>;",
      "export const D = <Badge>{planName}</Badge>;",
    ],
    rule: "no-plus-badge",
  },
  {
    bad: [
      'export const A = <Page className="pt-4" />;',
      'export const B = <DetailLayout className={cn("md:py-8", extra)} />;',
      'export const C = <Page><header className="-mt-2" /></Page>;',
      'export const D = <PageTop className="sm:mt-3" />;',
    ],
    good: [
      'export const A = <Page className="pb-8"><header /><section className="pt-4" /></Page>;',
      'export const B = <Page><header><div className="pt-4" /></header></Page>;',
      'export const C = <TaskFrame className="pt-4" />;',
    ],
    rule: "no-page-top-spacing",
  },
  {
    bad: [
      'export const A = <button aria-keyshortcuts="Enter" />;',
      "export const B = <button aria-keyshortcuts={'Enter'} />;",
      "export const C = <ShortcutKbd>⏎</ShortcutKbd>;",
      "export const D = <ShortcutKbd />;",
      "document.addEventListener('keydown', event => event.key);",
      "useKeyboardCallback();",
      "export function useKeyboardCallback() {}",
      "export const closeOnEscape = true;",
      "export const E = <EnterButton disabled={isPending} />;",
    ],
    good: [
      "export const A = <button aria-keyshortcuts={shortcutKeys('main')} />;",
      "export const B = <ShortcutKbd shortcut='main' />;",
      "document.addEventListener('pointerdown', () => true);",
      "export const C = <EnterButton disabled={pending} busy={pending} />;",
      "export const D = <Button disabled={pending} />;",
    ],
    lines: [1, 1, 1, 1, 2, 3, 4, 9],
    rule: "shortcut-keys",
  },
];

function lint() {
  const config = join(folder, "oxlintrc.json");

  for (const fixture of FIXTURES) {
    const { rule, bad, good } = fixture;
    const here = join(folder, rule);
    mkdirSync(here);
    writeFileSync(join(here, "bad.tsx"), bad.join("\n"));
    writeFileSync(join(here, "good.tsx"), good.join("\n"));

    if ("skipped" in fixture) {
      for (const [name, content] of Object.entries(fixture.skipped ?? {})) {
        const path = join(here, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
    }
  }

  writeFileSync(
    config,
    JSON.stringify({
      categories: { correctness: "off" },
      jsPlugins: [join(repository, "packages/oxlint-plugin/index.js")],
      overrides: FIXTURES.map(({ rule }) => ({
        files: [`${rule}/**/*.tsx`],
        rules: { [`zoonk/${rule}`]: "error" },
      })),
      plugins: [],
    }),
  );

  const result = spawnSync(
    join(repository, "node_modules/.bin/oxlint"),
    ["-c", config, "-f", "unix", folder],
    { encoding: "utf8" },
  );

  assert.equal(result.signal, null);
  assert.ok(result.status === 0 || result.status === 1, result.stderr);

  return result.stdout
    .split("\n")
    .flatMap((line) => {
      const report =
        /^(?<path>[^:]+):(?<line>\d+):\d+: .*\[Error\/zoonk\((?<rule>[^)]+)\)\]$/u.exec(
          line,
        )?.groups;

      return report ? [`${report.rule}/${basename(report.path ?? "")}:${report.line}`] : [];
    })
    .toSorted();
}

const reports: string[] = [];

beforeAll(() => {
  reports.push(...lint());
});

afterAll(() => {
  rmSync(folder, { force: true, recursive: true });
});

describe("interface convention source checks", () => {
  it.each(FIXTURES)("reports the violations of $rule and accepts its controls", (fixture) => {
    const { rule, bad } = fixture;
    const lines = fixture.lines ?? bad.map((_, index) => index + 1);

    assert.deepEqual(
      reports.filter((report) => report.startsWith(`${rule}/`)),
      lines.map((line) => `${rule}/bad.tsx:${line}`).toSorted(),
    );
  });
});
