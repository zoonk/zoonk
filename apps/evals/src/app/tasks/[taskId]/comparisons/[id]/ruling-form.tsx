"use client";

import { Button } from "@zoonk/ui/components/button";
import { useState, useTransition } from "react";
import { Choice, TextField } from "../_components/form-fields";
import { type RulingResult, ruleOnCaseAction } from "./actions";

const RULING_CHOICES = [
  { label: "Current", value: "incumbent" },
  { label: "Tie", value: "tie" },
  { label: "Challenger", value: "challenger" },
];

/** The owner's call on a case the readers left split, made with every read in view. */
export function RulingForm({
  blindRead,
  caseId,
  comparisonId,
  taskId,
}: {
  /** The owner's blind pick on this case, the ruling's starting point. */
  blindRead: string | null;
  caseId: string;
  comparisonId: string;
  taskId: string;
}) {
  const [result, setResult] = useState<RulingResult>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        startTransition(async () => {
          const saved = await ruleOnCaseAction(data).catch(() => ({
            error: "The server couldn’t be reached. Try again.",
          }));

          setResult(saved);
        });
      }}
    >
      <input name="taskId" type="hidden" value={taskId} />
      <input name="comparisonId" type="hidden" value={comparisonId} />
      <input name="caseId" type="hidden" value={caseId} />

      <div className="flex flex-col gap-1">
        <p className="font-medium">Rule on this case</p>
        <p className="text-muted-foreground text-sm">
          {blindRead
            ? "The readers disagree, so your blind read settled this case. A ruling replaces it."
            : "The readers disagree, so your read decides this case. Read it blind first if you can."}{" "}
          Here you can see which model wrote each answer, so a ruling isn’t blind.
        </p>
      </div>

      <Choice
        choices={RULING_CHOICES}
        defaultValue={RULING_CHOICES.find((choice) => choice.value === blindRead)?.value}
        label="Who serves the learner better"
        name="direction"
      />
      <TextField label="Why" name="reason" required />

      {result && (
        <p className="text-destructive-text text-sm" role="alert">
          {result.error}
        </p>
      )}

      <Button busy={pending} className="self-start" type="submit" variant="outline">
        Save ruling
      </Button>
    </form>
  );
}
