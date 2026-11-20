"use client";

import { Fold } from "@/components/fold";
import { type Adjudication } from "@/lib/comparisons/schemas";
import { Button } from "@zoonk/ui/components/button";
import { useState, useTransition } from "react";
import { Choice, TextField } from "../_components/form-fields";
import { DIRECTION_LABELS } from "../_utils/labels";
import { type RulingResult, ruleOnCaseAction } from "./actions";

const RULING_CHOICES = [
  { label: "Current", value: "incumbent" },
  { label: "Tie", value: "tie" },
  { label: "Challenger", value: "challenger" },
];

type RulingProps = {
  blindRead: string | null;
  caseId: string;
  comparisonId: string;
  ruling?: Pick<Adjudication, "direction" | "reason">;
  taskId: string;
};

export function RulingForm(props: RulingProps) {
  const { ruling } = props;

  if (!ruling) {
    return <EditRuling {...props} />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-1">
      <p className="text-sm">
        <span className="text-muted-foreground">Your ruling: </span>
        {DIRECTION_LABELS[ruling.direction]}.{" "}
        <span className="text-muted-foreground">{ruling.reason}</span>
      </p>
      <Fold key={JSON.stringify(ruling)} title="Change your ruling">
        <EditRuling {...props} />
      </Fold>
    </div>
  );
}

function EditRuling({ blindRead, caseId, comparisonId, ruling, taskId }: RulingProps) {
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
        defaultValue={
          ruling?.direction ?? RULING_CHOICES.find((choice) => choice.value === blindRead)?.value
        }
        label="Who serves the learner better"
        name="direction"
      />
      <TextField defaultValue={ruling?.reason} label="Why" name="reason" required />

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
