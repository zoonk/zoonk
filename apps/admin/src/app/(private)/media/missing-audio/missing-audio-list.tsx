import { AdminSection } from "@/components/admin-section";
import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import {
  MAX_MISSING_AUDIO_ROWS,
  type MissingAudioResource,
  listMissingAudio,
} from "@/data/media/list-missing-audio";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { type MissingAudioResourceKind } from "./_actions/upload-missing-audio";
import { MissingAudioUploadForm } from "./missing-audio-upload-form";

const MISSING_AUDIO_COLUMNS: AdminTableColumn[] = [
  { label: "Text" },
  { label: "Language" },
  { label: "Used in" },
  { align: "right", label: "Audio" },
];

function getQueueDescription(total: number): string | undefined {
  return total > MAX_MISSING_AUDIO_ROWS
    ? `Showing the first ${MAX_MISSING_AUDIO_ROWS}. Uploads clear rows, so the next ones appear.`
    : undefined;
}

/** Words and sentences Library lessons use without audio, each with its own upload. */
export async function MissingAudioList() {
  "use cache: private";

  const { sentenceTotal, sentences, wordTotal, words } = await listMissingAudio();

  return (
    <div className="flex flex-col gap-8">
      <AdminSection description={getQueueDescription(wordTotal)} title={`Words (${wordTotal})`}>
        <MissingAudioTable
          emptyLabel="Every word in Library lessons has audio."
          kind="word"
          resources={words}
        />
      </AdminSection>

      <AdminSection
        description={getQueueDescription(sentenceTotal)}
        title={`Sentences (${sentenceTotal})`}
      >
        <MissingAudioTable
          emptyLabel="Every sentence in Library lessons has audio."
          kind="sentence"
          resources={sentences}
        />
      </AdminSection>
    </div>
  );
}

function MissingAudioTable({
  emptyLabel,
  kind,
  resources,
}: {
  emptyLabel: string;
  kind: MissingAudioResourceKind;
  resources: MissingAudioResource[];
}) {
  return (
    <AdminTableColumns
      columns={MISSING_AUDIO_COLUMNS}
      emptyLabel={emptyLabel}
      isEmpty={resources.length === 0}
    >
      {resources.map((resource) => (
        <TableRow key={resource.id}>
          <TableCell className="max-w-80 min-w-48 font-medium whitespace-normal">
            {resource.text}
          </TableCell>
          <TableCell className="uppercase">{resource.targetLanguage}</TableCell>
          <TableCell className="max-w-80 min-w-48 whitespace-normal">
            <MissingAudioLessons resource={resource} />
          </TableCell>
          <TableCell>
            <MissingAudioUploadForm
              resourceId={resource.id}
              resourceKind={kind}
              text={resource.text}
            />
          </TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

/** A few lessons are enough to hear the word in context; the rest are counted. */
function MissingAudioLessons({ resource }: { resource: MissingAudioResource }) {
  const hiddenCount = resource.lessonCount - resource.lessons.length;

  return (
    <span className="flex flex-col gap-0.5 text-sm">
      {resource.lessons.map((lesson) => (
        <Link
          className="hover:underline"
          href={`/lessons/${lesson.id}`}
          key={lesson.id}
          prefetch={false}
        >
          {lesson.title}
        </Link>
      ))}
      {hiddenCount > 0 ? (
        <span className="text-muted-foreground text-xs">and {hiddenCount} more</span>
      ) : null}
    </span>
  );
}

export function MissingAudioListSkeleton() {
  return <AdminTableColumnsSkeleton columns={MISSING_AUDIO_COLUMNS} />;
}
