import { AdminSection } from "@/components/admin-section";
import { getSource } from "@/data/sources/get-source";
import { listChangeNotices } from "@/data/sources/list-change-notices";
import { ChangeNoticeTable } from "../change-notice-table";

/** Public sources only: a private upload shows its metadata and nothing else. */
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
      description="What learners were told after a new fetch changed this source."
      title="Change notices"
    >
      <ChangeNoticeTable
        emptyLabel="No fetch has changed this source yet."
        notices={notices}
        showExam
      />
    </AdminSection>
  );
}
