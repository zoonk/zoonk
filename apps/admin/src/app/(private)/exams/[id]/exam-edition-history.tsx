import { AdminSection } from "@/components/admin-section";
import { listChangeNotices } from "@/data/sources/list-change-notices";
import { ChangeNoticeTable } from "../../sources/change-notice-table";

/**
 * Each new edition or notice change leaves a change notice, so the blueprint's
 * notices, newest first, are its edition history.
 */
export async function ExamEditionHistory({ examBlueprintId }: { examBlueprintId: string }) {
  "use cache: private";

  const notices = await listChangeNotices({ id: examBlueprintId, owner: "exam" });

  return (
    <AdminSection
      description="What learners were told each time a new fetch changed this exam."
      title="Edition history"
    >
      <ChangeNoticeTable
        emptyLabel="No change since the blueprint was first read."
        notices={notices}
        showExam={false}
      />
    </AdminSection>
  );
}
