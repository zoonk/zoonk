import { type LearnerMilestoneKind } from "@/lib/learner-milestone-filters";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import Form from "next/form";

/**
 * The drill-down page keeps the threshold editable so admins can move from one
 * cohort size to another without going back to the engagement overview.
 */
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
