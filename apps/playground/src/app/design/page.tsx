import { PRINCIPLES } from "@/design-system/moments";
import { AnswerOption } from "@zoonk/learn/answer-option";
import { kindFillClass } from "@zoonk/learn/kind-tile";
import { MeterPart, MeterParts } from "@zoonk/learn/meter";
import { StatusMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import Link from "next/link";
import { PreviewIntlProvider } from "../preview/preview-intl-provider";
import { DevOnlySpecimen, DocHeader, DocRules, DocSection, renderCode } from "./_components/doc";
import { MODES, modeClass } from "./_components/modes";
import { DESIGN_PAGES } from "./_components/pages";

export const metadata: Metadata = { title: "Overview" };

const SOURCES = [
  "Values: `packages/ui/src/styles/globals.css`, every color in light, dark and both more-contrast modes, the type utilities and the subjects' hue table.",
  "Meanings and usage: `apps/playground/src/design-system/`, the typed module these pages render.",
  "Components: `@zoonk/ui` for controls, the learn kit (`packages/learn/src/_components`) for pages and data, the shell (`packages/learn/src/shell`) for the frame.",
  "How to design with it: the `zoonk-design` skill (`.agents/skills/zoonk-design`); when and how things move: the `zoonk-motion` skill (`.agents/skills/zoonk-motion`).",
];

const MODE_CHECKS = [
  "Pages follow the device's appearance and contrast; nothing in the app switches them.",
  "To see another mode, use the browser's rendering tools (Chrome: Rendering, then Emulate CSS media feature `prefers-color-scheme` or `prefers-contrast`), or Playwright's `colorScheme` and `contrast` options.",
  "These pages show every token in all four modes side by side, read from the stylesheet the browser loaded.",
];

/** The states a learner meets most, in each mode at a glance, drawn by the real components. */
function AtAGlance() {
  return (
    <PreviewIntlProvider>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODES.map((mode) => (
          <div
            className={cn(
              modeClass(mode.id),
              "ring-border flex flex-col gap-3 rounded-xl p-4 ring-1",
            )}
            key={mode.id}
          >
            <p className="text-muted-foreground text-xs font-medium">{mode.label}</p>
            <MeterParts>
              <MeterPart className="bg-success" weight={2} />
              <MeterPart
                className="ring-success bg-transparent ring-[1.5px] ring-inset"
                weight={5}
              />
              <MeterPart weight={4} />
              <MeterPart className={kindFillClass("practice")} weight={3} />
            </MeterParts>
            <AnswerOption marker={1} picked>
              Picked
            </AnswerOption>
            <AnswerOption marker={2} picked result="right">
              Right
            </AnswerOption>
            <AnswerOption marker={3} picked result="wrong">
              Wrong
            </AnswerOption>
            <p className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                <StatusMark status="done" />
                <StatusMark status="next" />
                <StatusMark status="todo" />
              </span>
              <span className="text-brain-text font-semibold">+50</span>
            </p>
          </div>
        ))}
      </div>
    </PreviewIntlProvider>
  );
}

export default function DesignOverviewPage() {
  return (
    <>
      <DocHeader title="Design system">
        Instrument: a calm study instrument. Neutral tone steps set a page&apos;s parts apart, and
        soft color goes only to what carries meaning: progress, wrong answers, flags, rewards, kinds
        and subjects. Every page keeps its structure; this is its visual language.
      </DocHeader>

      <DocSection title="Principles">
        <DocRules rules={PRINCIPLES} />
      </DocSection>

      <DocSection
        intro="The day's meter (done, the block in progress, practice), a pick in the text color, right in blue, wrong in pink-red, the status marks and a reward, in every mode."
        title="At a glance"
      >
        <DevOnlySpecimen>
          <AtAGlance />
        </DevOnlySpecimen>
      </DocSection>

      <DocSection title="Where it lives">
        <DocRules rules={SOURCES} />
      </DocSection>

      <DocSection title="Modes">
        <DocRules rules={MODE_CHECKS} />
      </DocSection>

      <DocSection title="Pages">
        <ul className="grid gap-2 sm:grid-cols-2">
          {DESIGN_PAGES.slice(1).map((page) => (
            <li key={page.href}>
              <Link
                className="hover:bg-muted ring-border block rounded-lg px-3 py-2.5 text-sm font-medium ring-1"
                href={page.href}
                prefetch
              >
                {renderCode(page.label)}
              </Link>
            </li>
          ))}
        </ul>
      </DocSection>
    </>
  );
}
