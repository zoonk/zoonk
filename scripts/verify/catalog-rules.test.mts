import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { catalogOffenders, treeCatalogs } from "./catalog-rules.mts";
import { SWITCHED_ON } from "./rules/catalog.mts";
import { auditStrings } from "./strings.mts";

const WEB = "apps/main/messages/en.po";
/** Apple's catalogs are large JSON files, and CI shares its runner. */
const TREE_TIMEOUT_MS = 60_000;

function po(entries: string[][]): string {
  return ['msgid ""', 'msgstr ""', "", ...entries.flatMap((entry) => [...entry, ""])].join("\n");
}

function android(path: string, strings: string[]) {
  return {
    content: [
      "<resources>",
      ...strings.map((text, index) => `    <string name="s${index}">${text}</string>`),
      "</resources>",
    ].join("\n"),
    path: `apps/android/core/resources/src/main/res/values/${path}`,
  };
}

function offenders(catalogs: { content: string; path: string }[]) {
  return catalogOffenders(catalogs).map((offender) => `${offender.rule} ${offender.text}`);
}

describe("the founder's catalog rules", () => {
  it("asks for Subscribe wherever an action or a sentence leads to paying", () => {
    const catalog = po([
      ['msgid "See Plus"'],
      ['msgid "That\'s all for today, or get Plus to keep going now."'],
      ['msgid "Upgrade"'],
      ['msgid "See plans"'],
      ['msgid "Subscribe"'],
    ]);

    assert.deepEqual(
      offenders([{ content: catalog, path: WEB }]).filter((line) => line.startsWith("subscribe")),
      [
        "subscribe See Plus",
        "subscribe That's all for today, or get Plus to keep going now.",
        "subscribe Upgrade",
        "subscribe See plans",
      ],
    );
  });

  it("keeps the plan's name to where plans are compared and to what only subscribers see", () => {
    const catalog = po([
      ["#: src/app/[lang]/(app)/(learn)/today/row.tsx", 'msgid "Available with Plus"'],
      ["#: src/components/pricing/plus-plan.tsx", 'msgid "What Plus includes"'],
      [
        "#: src/components/pricing/plus-plan.tsx",
        "#: src/app/[lang]/(home)/_components/exam-section.tsx",
        'msgid "Mock exams, with Plus"',
      ],
      [
        "#. Shown only to subscribers, beside their email.",
        "#: src/app/[lang]/(app)/(settings)/_components/settings-eyebrow.tsx",
        'msgid "{email} · Plus"',
      ],
      ["#: src/code/symbols.tsx", 'msgid "Plus sign"'],
    ]);

    assert.deepEqual(offenders([{ content: catalog, path: WEB }]), [
      "planName Available with Plus",
      "planName Mock exams, with Plus",
    ]);

    assert.deepEqual(
      offenders([
        android("strings_subscription.xml", ["Cancel Plus"]),
        android("strings_today.xml", ["Plus"]),
      ]),
      ["planName Plus"],
    );
  });

  it('flags a "none" option, since Skip already answers none', () => {
    assert.deepEqual(
      offenders([
        android("strings_profile_questions.xml", ["None of these", "Nothing to add", "None"]),
      ]),
      ["noneOption None of these", "noneOption Nothing to add"],
    );
  });

  it("asks about a string a change adds, as a lead", () => {
    const flags = auditStrings([{ added: [], created: false, path: WEB }], {
      read: (path) => (path === WEB ? po([['msgid "See Plus"'], ['msgid "Keep going"']]) : ""),
      readBase: (path) => (path === WEB ? po([['msgid "Keep going"']]) : ""),
    });

    assert.deepEqual(
      flags.map((flag) => flag.rule.name),
      ['Paying isn\'t "Subscribe"', "Plan's name outside pricing"],
    );
  });

  it("holds every switched-on rule on the whole tree", { timeout: TREE_TIMEOUT_MS }, () => {
    const broken =
      SWITCHED_ON.length > 0
        ? catalogOffenders(treeCatalogs()).filter((offender) =>
            SWITCHED_ON.some((rule) => rule === offender.rule),
          )
        : [];

    assert.deepEqual(broken, []);
  });
});
