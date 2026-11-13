import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { type AdminMediaAsset, MAX_MEDIA_USAGE_ROWS } from "@/data/media/get-media";
import { formatCount, toWords } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";

const SCREEN_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson" },
  { align: "right", label: "Screen", size: "narrow" },
  { label: "Kind" },
];

/** The lesson screens that show the asset, so staff can open the lesson a learner saw it in. */
export function MediaUsage({ asset }: { asset: AdminMediaAsset }) {
  const total = asset._count.steps;

  return (
    <AdminSection
      description={
        total > MAX_MEDIA_USAGE_ROWS ? `Showing the first ${MAX_MEDIA_USAGE_ROWS}.` : undefined
      }
      title={total > 0 ? `Used on ${formatCount(total, "screen")}` : "Used on"}
    >
      <AdminTableColumns
        columns={SCREEN_COLUMNS}
        emptyLabel="No lesson screen shows it."
        isEmpty={asset.steps.length === 0}
      >
        {asset.steps.map((step) => (
          <AdminTableRow key={step.id}>
            <AdminNameCell href={`/lessons/${step.lesson.id}`} title={step.lesson.title} />
            <TableCell numeric>{step.position + 1}</TableCell>
            <TableCell>{toWords(step.kind)}</TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}
