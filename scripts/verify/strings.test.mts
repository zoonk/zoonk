import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type ChangedFile } from "./diff-audit.mts";
import { STYLE_GUIDE, auditStrings, insideButton, neverTerms, readCatalog } from "./strings.mts";

const STYLE = [
  "# `en` styleguide",
  "",
  "## Plain words first",
  "",
  "| Term | Taught on | Before that, say |",
  "| --- | --- | --- |",
  "| time a day, daily time | the schedule step | how long you study each day |",
  "| placement, starting point | never (internal) | what you already know |",
  "| sitting, block | never (internal) | (rewrite the sentence) |",
  "",
  "## Honest progress",
].join("\n");

const WEB = "apps/main/messages/en.po";
const SOURCE = "apps/main/src/start.tsx";

function po(entries: string[][]): string {
  return ['msgid ""', 'msgstr ""', "", ...entries.flatMap((entry) => [...entry, ""])].join("\n");
}

function changed(path: string): ChangedFile {
  return { added: [], created: false, path };
}

function audit(files: Record<string, string>, base: Record<string, string> = {}) {
  return auditStrings(
    Object.keys(files)
      .filter((path) => path !== STYLE_GUIDE && path !== SOURCE)
      .map((path) => changed(path)),
    { read: (path) => files[path] ?? "", readBase: (path) => base[path] ?? "" },
  ).map((flag) => `${flag.rule.name} ${flag.lines.join(",")} ${flag.sample}`);
}

describe("reading the catalogs", () => {
  it("reads a web catalog's strings, notes and the sources that use them", () => {
    const catalog = po([
      ["#. “Daily time” is how long the learner studies.", "#: src/start.tsx", 'msgid "Save"'],
      ['msgid ""', String.raw`"Two \"quoted\" "`, '"lines"'],
    ]);

    assert.deepEqual(readCatalog(WEB, catalog), [
      {
        line: 6,
        note: "“Daily time” is how long the learner studies.",
        sources: [SOURCE],
        text: "Save",
      },
      { line: 8, note: "", sources: [], text: 'Two "quoted" lines' },
    ]);
  });

  it("reads Apple's English values and Android's translatable strings", () => {
    const apple = JSON.stringify(
      {
        sourceLanguage: "en",
        strings: {
          "%lld lessons": {
            localizations: {
              en: { variations: { plural: { one: { stringUnit: { value: "%lld lesson" } } } } },
            },
          },
          Keep: { comment: "Keeps the plan", localizations: { pt: {} } },
        },
      },
      null,
      2,
    ).replaceAll('":', '" :');

    assert.deepEqual(
      readCatalog("apps/apple/Zoonk/Resources/Localization/Plan.xcstrings", apple).map(
        ({ line, note, text }) => `${line} ${text} (${note})`,
      ),
      ["4 %lld lesson ()", "19 Keep (Keeps the plan)"],
    );

    const android = [
      "<resources>",
      '    <string name="app_name" translatable="false">Zoonk</string>',
      "    <!-- A button. -->",
      String.raw`    <string name="keep">Keep what you\'ve done</string>`,
      "</resources>",
    ].join("\n");

    assert.deepEqual(
      readCatalog("apps/android/core/resources/src/main/res/values/strings_plan.xml", android),
      [{ line: 4, note: "A button.", sources: [], text: "Keep what you've done" }],
    );
  });

  it("tells a label inside a button, even a few lines below its opening tag", () => {
    const source = [
      '<Button onClick={save}>{t("Save")}</Button>',
      '<p>{t("Saved")}</p>',
      "<SubmitButton>",
      "  {t({",
      '    description: "Saves the plan",',
      '    message: "Save and go on",',
      "  })}",
      "</SubmitButton>",
    ].join("\n");

    assert.ok(insideButton(source, "Save"));
    assert.ok(!insideButton(source, "Saved"));
    assert.ok(insideButton(source, "Save and go on"));
  });

  it("reads the never-shown terms from the style guide, and none without its table", () => {
    assert.deepEqual(neverTerms(STYLE), ["placement", "starting point", "sitting", "block"]);
    assert.deepEqual(neverTerms("# `en` styleguide"), []);
  });
});

describe("questioning a change's strings", () => {
  it("asks about each new or reworded string, never one the base already had", () => {
    const long =
      "This plan moves your lessons around so you finish on time, and it keeps every lesson you already did in the same place";

    const before = po([['msgid "Save"'], [`msgid "${long}"`]]);

    const after = po([
      ['msgid "Save"'],
      [`msgid "${long}"`],
      ["#: src/start.tsx", 'msgid "Continue to daily time"'],
      ["#: src/start.tsx", 'msgid "Show all {count, number}"'],
      ['msgid "Your sitting may take up to an hour"'],
      ['#. "Coverage" means the share of subjects studied.', 'msgid "Coverage"'],
    ]);

    assert.deepEqual(
      audit(
        Object.fromEntries([
          [STYLE_GUIDE, STYLE],
          [
            SOURCE,
            '<Button>{t("Continue to daily time")}</Button>\n<Button>{t("Show all {count, number}")}</Button>',
          ],
          [WEB, after],
        ]),
        { [WEB]: before },
      ),
      [
        "Long button label 9 Continue to daily time",
        "Hedge 14 Your sitting may take up to an hour",
        "Term learners never see 14 sitting: Your sitting may take up to an hour",
        'Note defines a word 17 "Coverage" means the share of subjects studied.',
      ],
    );
  });

  it("holds marketing pages' strings to every check but the app's length budget", () => {
    const pitch =
      "Tell us what you want to learn and we plan every day until you get there, so you always know what to study next";

    const catalog = po([
      ["#: src/app/[lang]/(home)/page.tsx", `msgid "${pitch}"`],
      ["#: src/components/pricing/plus-plan.tsx", 'msgid "Cancel for now, any time"'],
      [
        "#: src/app/[lang]/(home)/page.tsx",
        "#: src/app/[lang]/(app)/(learn)/today/page.tsx",
        `msgid "${pitch}!"`,
      ],
    ]);

    assert.deepEqual(
      audit({ [WEB]: catalog }).map((flag) => flag.replace(/^(?<where>\D+ \d+).*/u, "$<where>")),
      ["Hedge 8", "Long string 12"],
    );
  });

  it("skips the never-shown terms quietly when the style guide has no table yet", () => {
    assert.deepEqual(audit({ [WEB]: po([['msgid "Your placement"']]) }), []);
  });

  it("reads only catalogs", () => {
    assert.deepEqual(audit({ "apps/main/src/x.tsx": 'msgid "It may rain"' }), []);
  });
});
