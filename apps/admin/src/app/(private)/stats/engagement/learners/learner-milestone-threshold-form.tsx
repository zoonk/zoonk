import { AdminSmallInput } from "@/components/admin-small-input";
import { type LearnerMilestoneKind } from "@/lib/learner-milestone-filters";
import Form from "next/form";

/** The list's one filter, said as a sentence: "At least 10 lessons". Enter applies it. */
export function LearnerMilestoneThresholdForm({
  kind,
  threshold,
  unit,
}: {
  kind: LearnerMilestoneKind;
  threshold: number;
  unit: string;
}) {
  return (
    <Form action="/stats/engagement/learners">
      <input name="kind" type="hidden" value={kind} />

      <label className="flex items-center gap-2 text-sm">
        At least
        <AdminSmallInput
          className="md:text-compact px-2.5"
          defaultValue={threshold}
          frameClassName="w-16"
          inputMode="numeric"
          key={threshold}
          min={1}
          name="threshold"
          type="number"
        />
        {unit}
      </label>
    </Form>
  );
}
