import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type AdminMediaAsset, MAX_MEDIA_USAGE_ROWS, getMedia } from "@/data/media/get-media";
import { TableCell } from "@zoonk/ui/components/table";

const STEP_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson" },
  { align: "right", label: "Position" },
  { label: "Kind" },
];

export async function MediaUsage({ mediaAssetId }: { mediaAssetId: string }) {
  "use cache: private";

  const asset = await getMedia(mediaAssetId);

  if (!asset) {
    return null;
  }

  const total = asset._count.steps;

  return (
    <AdminSection
      description={
        total > MAX_MEDIA_USAGE_ROWS ? `Showing the first ${MAX_MEDIA_USAGE_ROWS}.` : undefined
      }
      title={`Steps (${total})`}
    >
      <MediaStepsTable steps={asset.steps} />
    </AdminSection>
  );
}

function MediaStepsTable({ steps }: { steps: AdminMediaAsset["steps"] }) {
  return (
    <AdminTableColumns
      columns={STEP_COLUMNS}
      emptyLabel="No step shows this asset."
      isEmpty={steps.length === 0}
    >
      {steps.map((step) => (
        <AdminTableRow key={step.id}>
          <TableCell>
            <AdminTableRowLink href={`/lessons/${step.lesson.id}`} prefetch={false}>
              {step.lesson.title}
            </AdminTableRowLink>
          </TableCell>
          <TableCell className="text-right tabular-nums">{step.position}</TableCell>
          <TableCell>{step.kind}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}
