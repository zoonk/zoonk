"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zoonk/ui/components/dialog";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon, LayoutGridIcon, PenLineIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useMockScreen } from "./mock-context";
import { isDraftAnswered } from "./use-mock-drafts";

/**
 * How much of the running section is answered, flagged and still blank: its questions, and apart
 * from them its essays (a full mock's written part).
 */
export function useSectionCounts() {
  const { runner } = useMockScreen();
  const questions = runner.view.current?.questions ?? [];
  const isBlank = (itemId: string) => !isDraftAnswered(runner.drafts[itemId]);
  const blank = questions.filter((question) => isBlank(question.itemId));

  return {
    answered: questions.length - blank.length,
    blank: blank.filter((question) => question.format !== "essay").length,
    blankEssays: blank.filter((question) => question.format === "essay").length,
    essays: questions.filter((question) => question.format === "essay").length,
    flagged: questions.filter((question) => runner.drafts[question.itemId]?.flagged).length,
    total: questions.length,
  };
}

function SheetGrid({ onPick }: { onPick: (position: number) => void }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const questions = runner.view.current?.questions ?? [];

  return (
    <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8">
      {questions.map((question, index) => {
        const draft = runner.drafts[question.itemId];
        const answered = isDraftAnswered(draft);
        const isEssay = question.format === "essay";

        return (
          <li key={question.itemId}>
            <button
              aria-current={index === runner.position ? "true" : undefined}
              aria-label={
                isEssay
                  ? t("Written part")
                  : t("Question {number}", { number: String(question.number) })
              }
              className={cn(
                "border-border focus-visible:ring-ring/50 relative flex size-11 items-center justify-center rounded-xl border text-sm font-medium tabular-nums outline-none focus-visible:ring-[3px] disabled:opacity-50",
                answered && "bg-foreground text-background border-transparent",
                index === runner.position && "ring-foreground/30 ring-2",
              )}
              // A forward-only section's sheet shows every question but opens none behind.
              disabled={!runner.moves.canOpen(index)}
              onClick={() => onPick(index)}
              type="button"
            >
              {isEssay ? <PenLineIcon aria-hidden="true" className="size-4" /> : question.number}
              {draft?.flagged && (
                <FlagIcon
                  aria-hidden="true"
                  className="text-warning absolute -top-1.5 -right-1.5 size-3.5 fill-current"
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The answer sheet: every question of the running section at a glance (answered, flagged, still
 * blank), a tap to jump to one, and handing the section in (`onHandIn` confirms it first).
 */
export function MockAnswerSheet({ onHandIn }: { onHandIn: () => void }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const [open, setOpen] = useState(false);
  const counts = useSectionCounts();
  const isLast = runner.view.sections.at(-1)?.status === "current";

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        aria-label={t("Answer sheet")}
        render={<Button className="w-14 shrink-0 px-0" size="xl" variant="outline" />}
      >
        <LayoutGridIcon aria-hidden="true" />
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto" closeLabel={t("Close")}>
        <DialogHeader>
          <DialogTitle>{t("Answer sheet")}</DialogTitle>
          <DialogDescription>
            {t(
              "{answered, plural, =0 {# answered} one {# answered} other {# answered}} · {flagged, plural, =0 {# flagged} one {# flagged} other {# flagged}} · {blank, plural, =0 {# blank} one {# blank} other {# blank}}",
              {
                answered: counts.answered,
                blank: counts.blank + counts.blankEssays,
                flagged: counts.flagged,
              },
            )}
          </DialogDescription>
        </DialogHeader>

        <SheetGrid
          onPick={(position) => {
            runner.go(position);
            setOpen(false);
          }}
        />

        <DialogFooter>
          <Button
            disabled={runner.pending}
            onClick={() => {
              setOpen(false);
              onHandIn();
            }}
          >
            {isLast ? t("Hand in the mock exam") : t("Hand in this section")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
