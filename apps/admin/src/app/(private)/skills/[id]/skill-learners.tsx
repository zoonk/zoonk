import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { MasteryMeter } from "@/components/mastery-meter";
import { countSkillLearnersByState } from "@/data/skills/get-skill-usage";
import { formatCount } from "@/lib/format";
import { sumOf } from "@zoonk/utils/number";

/** How far the learners practicing it are. Accounts left out of analytics aren't counted. */
export async function SkillLearners({ skillId }: { skillId: string }) {
  "use cache: private";

  const states = await countSkillLearnersByState(skillId);
  const total = sumOf(states.map((row) => row.count));

  return (
    <AdminSection title={total > 0 ? formatCount(total, "learner") : "Learners"}>
      {total > 0 ? (
        <MasteryMeter states={states} />
      ) : (
        <AdminSectionEmpty>No learner has practiced it yet.</AdminSectionEmpty>
      )}
    </AdminSection>
  );
}
