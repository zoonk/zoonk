import { AdminSection } from "@/components/admin-section";
import { getSource } from "@/data/sources/get-source";
import { listChangeNotices } from "@/data/sources/list-change-notices";
import { ChangeNoticeTable } from "../change-notice-table";

export async function SourceChangeNotices({ sourceId }: { sourceId: string }) {
  "use cache: private";

  const [source, notices] = await Promise.all([
    getSource(sourceId),
    listChangeNotices({ id: sourceId, owner: "source" }),
  ]);

  if (source?.visibility !== "public") {
    return null;
  }

  return (
    <AdminSection
      description="What learners were told each time a check found the source changed."
      title="What changed"
    >
      <ChangeNoticeTable emptyLabel="No check has found a change yet." notices={notices} showExam />
    </AdminSection>
  );
}
