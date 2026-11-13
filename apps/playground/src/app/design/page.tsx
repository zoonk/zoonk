import { PRINCIPLES } from "@/design-system/moments";
import { AnswerOption } from "@zoonk/learn/answer-option";
import { kindFillClass } from "@zoonk/learn/kind-tile";
import { MeterPart, MeterParts } from "@zoonk/learn/meter";
import { StatusMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import { PreviewIntlProvider } from "../preview/preview-intl-provider";
import { DevOnlySpecimen, DocHeader, DocRules, DocSection } from "./_components/doc";
import { MODES, modeClass } from "./_components/modes";

export const metadata: Metadata = { title: "Overview" };

const SOURCES = [
  "Values: `packages/ui/src/styles/globals.css`, every color in light, dark and both more-contrast modes, the type utilities and the subjects' hue table.",
  "Meanings and usage: `apps/playground/src/design-system/`, the typed module these pages render.",
  "Components: `@zoonk/ui` for controls, the learn kit (`packages/learn/src/_components`) for pages and data, the shell (`packages/learn/src/shell`) for the frame.",
  "How to design with it: the `zoonk-design` skill (`.agents/skills/zoonk-design`); when and how things move: the `zoonk-motion` skill (`.agents/skills/zoonk-motion`).",
  "How a screen is drawn, as rules with a number (edges, gaps, corners, control sizes, type, icons): the skill's craft reference (`.agents/skills/zoonk-design/references/craft.md`).",
];

const MODE_CHECKS = [
  "Pages follow the device's appearance and contrast; nothing in the app switches them.",
  "To see another mode, use the browser's rendering tools (Chrome: Rendering, then Emulate CSS media feature `prefers-color-scheme` or `prefers-contrast`), or Playwright's `colorScheme` and `contrast` options.",
  "These pages show every token in all four modes side by side, read from the stylesheet the browser loaded.",
];

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
        What every color, type role, shape, pattern and moment means and where it goes, so every
        screen looks and reads like one product. Each screen says one thing, color marks only what
        carries meaning, and every page keeps its structure.
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
    </>
  );
}
