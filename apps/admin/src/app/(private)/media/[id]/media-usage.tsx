import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { type AdminMediaAsset, MAX_MEDIA_USAGE_ROWS, getMedia } from "@/data/media/get-media";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

const STEP_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson" },
  { align: "right", label: "Position" },
  { label: "Kind" },
];

/** Every lesson screen that shows this asset. */
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
        <TableRow key={step.id}>
          <TableCell>
            <Link className="hover:underline" href={`/lessons/${step.lesson.id}`} prefetch={false}>
              {step.lesson.title}
            </Link>
          </TableCell>
          <TableCell className="text-right tabular-nums">{step.position}</TableCell>
          <TableCell>{step.kind}</TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}
