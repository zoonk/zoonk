import { countPendingReviews } from "@/data/review/count-pending-reviews";
import { REVIEW_GROUPS, getTasksByGroup } from "@/lib/review-utils";
import { ReviewCategorySection } from "./_components/review-category-section";

export async function ReviewLanding() {
  const counts = await countPendingReviews();

  return (
    <div className="flex flex-col gap-6">
      {REVIEW_GROUPS.map(({ group, label }) => {
        const tasks = getTasksByGroup(group);

        if (tasks.length === 0) {
          return null;
        }

        return <ReviewCategorySection key={group} label={label} tasks={tasks} counts={counts} />;
      })}
    </div>
  );
}
