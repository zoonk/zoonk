"use client";

import { type PlanToolView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  CalculatorIcon,
  ChevronDownIcon,
  CodeIcon,
  SheetIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { SectionLabel } from "../_components/section-label";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { PlanToolSheet } from "./plan-tool-sheet";
import { useSystemName } from "./use-system-name";
import { useToolChoice } from "./use-tool-choice";

/** "Spreadsheet (Google Sheets or Excel)" reads as the tool, then the usual choices. */
const CHOICES_PATTERN = /^(?<tool>.+?)\s*\((?<choices>[^()]+)\)$/u;

/** Picks an icon from common words in the tool's name; anything else is a tool. */
const ICONS = [
  { icon: CalculatorIcon, pattern: /calculat|calculad|rechner/iu },
  { icon: SheetIcon, pattern: /sheet|excel|planilha|hoja|tabell|tableur/iu },
  { icon: TerminalIcon, pattern: /terminal|shell|comand|command|konsole/iu },
  { icon: CodeIcon, pattern: /python|code|código|javascript|sql|editor|\bR\b/iu },
] as const;

function ToolIcon({ name }: { name: string }) {
  const Icon = ICONS.find((entry) => entry.pattern.test(name))?.icon ?? WrenchIcon;

  return (
    <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

function ToolStatus({ tool }: { tool: PlanToolView }) {
  const t = useExtracted();
  const systemName = useSystemName();

  switch (tool.choice) {
    case "have":
      return <span className="text-success font-medium">{t("You have it")}</span>;
    case "setup":
      return tool.system
        ? t("Setup lesson for {device}", { device: systemName(tool.system) })
        : t("Setup lesson first");
    case "none":
      return t("Examples only");
    case null:
      return tool.essential ? t("Needed to practice") : t("Optional");
    default:
      return tool.choice satisfies never;
  }
}

function ToolRow({ onChoose, tool }: { onChoose: () => void; tool: PlanToolView }) {
  const t = useExtracted();
  const match = CHOICES_PATTERN.exec(tool.name)?.groups;

  // Beside a moon on Fun's route the card is narrow: the button moves under the name there.
  return (
    <li className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-2 @max-2xs:grid-cols-[auto_1fr]">
      <ToolIcon name={tool.name} />

      {/* The usual choices get their own line under the name, so no "·" is left hanging. */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium">{match?.tool ?? tool.name}</p>
        {match?.choices && <p className="text-muted-foreground text-xs">{match.choices}</p>}
        <p className="text-muted-foreground text-xs">
          <ToolStatus tool={tool} />
        </p>
      </div>

      <Button
        aria-label={
          tool.choice
            ? t("Change how you'll use {tool}", { tool: tool.name })
            : t("Choose how you'll use {tool}", { tool: tool.name })
        }
        className="in-data-[mode=fun]:fun-glass @max-2xs:col-start-2 @max-2xs:justify-self-start"
        onClick={onChoose}
        size="sm"
        variant={tool.choice ? "ghost" : "outline"}
      >
        {tool.choice ? t("Change") : t("Choose")}
      </Button>
    </li>
  );
}

/**
 * Going without every tool is one tap; once chosen, the card says what that path can't give, and
 * focus moves to that note in place of the button.
 */
function NoToolsPath({ tools }: { tools: PlanToolView[] }) {
  const t = useExtracted();
  const noteRef = useRef<HTMLParagraphElement>(null);
  const { choose, failed, isPending } = useToolChoice(() => noteRef.current);

  if (tools.every((tool) => tool.choice === "none")) {
    return (
      <p
        className="text-muted-foreground focus-visible:ring-ring/50 rounded-sm text-sm outline-none focus-visible:ring-[3px]"
        ref={noteRef}
        tabIndex={-1}
      >
        {t(
          "You won't practice on your own computer. Lessons use examples and simulations instead.",
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 h-auto min-h-11 justify-start px-0 text-left text-sm font-normal whitespace-normal underline underline-offset-4 hover:bg-transparent"
        disabled={isPending}
        focusableWhenDisabled
        onClick={() =>
          choose({ choice: "none", system: null, tools: tools.map((tool) => tool.name) })
        }
        variant="ghost"
      >
        {t("No tools? You can do it all with examples.")}
      </Button>
      {failed && <PlanFailedMessage />}
    </div>
  );
}

/**
 * Tools only later phases use: named on one line, and opened on request, so a months-long plan
 * doesn't ask about a tool it won't need for months.
 */
function LaterTools({
  onChoose,
  tools,
}: {
  onChoose: (tool: PlanToolView) => void;
  tools: PlanToolView[];
}) {
  const t = useExtracted();

  if (tools.length === 0) {
    return null;
  }

  return (
    <details className="group flex flex-col open:gap-2">
      {/* A flex summary drops the native triangle, so the chevron says it opens. */}
      <summary className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-1 text-sm [&::-webkit-details-marker]:hidden">
        {t("More later: {tools}", {
          tools: tools
            .map((tool) => CHOICES_PATTERN.exec(tool.name)?.groups?.tool ?? tool.name)
            .join(", "),
        })}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>

      <ul className="divide-border flex flex-col divide-y">
        {tools.map((tool) => (
          <ToolRow key={tool.name} onChoose={() => onChoose(tool)} tool={tool} />
        ))}
      </ul>
    </details>
  );
}

/**
 * "You'll use": the tools the phase the learner is in uses, essential ones first, and the rest
 * under "More later". For each, the learner says they have it, they'll set it up (a short lesson
 * for their device comes right before the first chapter that uses it), or no install. Nothing
 * shows when no chapter uses a tool. It sits at the end of the current phase, under a rule in
 * Focus's phase card and on its own glass in Fun's route.
 *
 * ```tsx
 * <PlanPhases tools={<PlanTools />} />
 * ```
 */
export function PlanTools() {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const [editing, setEditing] = useState<PlanToolView | null>(null);

  const now = plan.tools.filter((tool) => !tool.later);
  const later = plan.tools.filter((tool) => tool.later);

  if (plan.tools.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="plan-tools-title"
      className="border-border in-data-[mode=fun]:fun-glass @container flex flex-col gap-2 border-t pt-3 in-data-[mode=fun]:mt-1 in-data-[mode=fun]:rounded-2xl in-data-[mode=fun]:border-t-0 in-data-[mode=fun]:p-4"
    >
      <SectionLabel id="plan-tools-title">{t("You'll use")}</SectionLabel>

      {now.length > 0 && (
        <ul className="divide-border flex flex-col divide-y">
          {now.map((tool) => (
            <ToolRow key={tool.name} onChoose={() => setEditing(tool)} tool={tool} />
          ))}
        </ul>
      )}

      <LaterTools onChoose={setEditing} tools={later} />
      <NoToolsPath tools={plan.tools} />
      <PlanToolSheet onClose={() => setEditing(null)} tool={editing} />
    </section>
  );
}
