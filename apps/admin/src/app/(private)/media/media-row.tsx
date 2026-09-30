import { ProvenanceLine } from "@/components/provenance";
import { type ListedMediaAsset } from "@/data/media/list-media";
import { formatDate } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { formatMediaSize, formatMediaUsage } from "./_utils/media-format";
import { MediaPreview } from "./media-preview";

export function MediaRow({ asset }: { asset: ListedMediaAsset }) {
  return (
    <TableRow>
      <TableCell>
        <MediaPreview asset={asset} size="thumbnail" />
      </TableCell>
      <TableCell className="max-w-72 min-w-48 whitespace-normal">
        <Link
          className="font-mono text-xs break-all hover:underline"
          href={`/media/${asset.id}`}
          prefetch
        >
          {asset.reuseKey}
        </Link>
      </TableCell>
      <TableCell className="capitalize">{asset.kind}</TableCell>
      <TableCell className="uppercase">{asset.language ?? "—"}</TableCell>
      <TableCell className="tabular-nums">{asset.styleVersion ?? "—"}</TableCell>
      <TableCell>{asset.palette ?? "—"}</TableCell>
      <TableCell className="tabular-nums">{formatMediaSize(asset)}</TableCell>
      <TableCell>{formatMediaUsage(asset._count)}</TableCell>
      <TableCell>
        <ProvenanceLine provenance={asset} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(asset.createdAt)}</TableCell>
    </TableRow>
  );
}
