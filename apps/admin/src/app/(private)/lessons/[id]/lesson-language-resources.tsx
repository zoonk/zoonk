import { AdminSection } from "@/components/admin-section";
import { type LibraryLessonDetail } from "@/data/lessons/get-library-lesson";
import Link from "next/link";

type Lesson = LibraryLessonDetail["lesson"];

function AudioLabel({ audioUrl }: { audioUrl: string | null }) {
  return audioUrl ? (
    <span className="text-muted-foreground">audio</span>
  ) : (
    <span className="text-destructive">no audio</span>
  );
}

/**
 * Language lessons teach shared words and sentences whose audio is shared per target language.
 * Missing audio is fixed on the media page, which lists every word and sentence without it.
 */
export function LessonLanguageResources({
  sentences,
  words,
}: {
  sentences: Lesson["sentences"];
  words: Lesson["words"];
}) {
  if (words.length === 0 && sentences.length === 0) {
    return null;
  }

  const missingAudio = [
    ...words.map((entry) => entry.word),
    ...sentences.map((entry) => entry.sentence),
  ].some((resource) => !resource.audioUrl);

  return (
    <AdminSection
      action={
        missingAudio ? (
          <Link className="text-sm underline" href="/media/missing-audio">
            Fix missing audio
          </Link>
        ) : null
      }
      title="Words and sentences"
    >
      <ul className="flex flex-col gap-1 text-sm">
        {words.map((entry) => (
          <li className="flex justify-between gap-4" key={entry.wordId}>
            <span>
              {entry.word.word} <span className="text-muted-foreground">· {entry.translation}</span>
            </span>
            <AudioLabel audioUrl={entry.word.audioUrl} />
          </li>
        ))}
        {sentences.map((entry) => (
          <li className="flex justify-between gap-4" key={entry.sentenceId}>
            <span>
              {entry.sentence.sentence}{" "}
              <span className="text-muted-foreground">· {entry.translation}</span>
            </span>
            <AudioLabel audioUrl={entry.sentence.audioUrl} />
          </li>
        ))}
      </ul>
    </AdminSection>
  );
}
