import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { countSkillLearnersByState } from "@/data/skills/get-skill-usage";
import { type MasteryState } from "@zoonk/db";

const MASTERY_STATE_LABELS: Record<MasteryState, string> = {
  learning: "Learning",
  mastered: "Mastered",
  new: "New",
  solid: "Solid",
};

/** Learner counts by mastery state; the learners themselves stay on their user pages. */
export async function SkillLearners({ skillId }: { skillId: string }) {
  "use cache: private";

  const states = await countSkillLearnersByState(skillId);

  return (
    <AdminSection
      description="Learners by mastery state, without accounts left out of analytics."
      title="Learners"
    >
      <dl className="divide-y">
        {states.map((row) => (
          <DetailField key={row.state} label={MASTERY_STATE_LABELS[row.state]}>
            <span className="tabular-nums">{row.count}</span>
          </DetailField>
        ))}
      </dl>
    </AdminSection>
  );
}
