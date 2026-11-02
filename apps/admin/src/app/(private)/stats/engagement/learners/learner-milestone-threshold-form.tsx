import { type LearnerMilestoneKind } from "@/lib/learner-milestone-filters";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import Form from "next/form";

export function LearnerMilestoneThresholdForm({
  inputLabel,
  kind,
  threshold,
}: {
  inputLabel: string;
  kind: LearnerMilestoneKind;
  threshold: number;
}) {
  return (
    <Form
      action="/stats/engagement/learners"
      className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
    >
      <input name="kind" type="hidden" value={kind} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label htmlFor="milestone-threshold">{inputLabel}</Label>
        <Input
          defaultValue={threshold}
          id="milestone-threshold"
          key={threshold}
          min={1}
          name="threshold"
          type="number"
        />
      </div>

      <Button type="submit" variant="outline">
        Apply
      </Button>
    </Form>
  );
}
