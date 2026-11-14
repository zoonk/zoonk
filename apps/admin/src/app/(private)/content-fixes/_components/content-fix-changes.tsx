import { AdminJson } from "@/components/admin-json";
import { type ContentFixDetail, rowKeyOf } from "@/data/content-fixes/get-content-fix";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import Link from "next/link";
import { connection } from "next/server";
import { CollectionChange } from "./content-fix-collection";
import { Restored } from "./content-fix-restored";
import { type FieldChange, FieldChanges, type Names } from "./content-fix-values";

const MODEL_LABELS: Record<StoredChange["model"], string> = {
  AnswerExplanation: "Answer explanation",
  Chapter: "Chapter",
  ChapterMindMap: "Chapter mind map",
  ConversationScenario: "Conversation scenario",
  Course: "Course",
  ExamBlueprint: "Exam blueprint",
  ExamCourseWeights: "Exam course weights",
  ExamSkillGraph: "Exam skill graph",
  Item: "Practice question",
  ItemSet: "Question set",
  LanguageLevelTest: "Level test",
  LanguageSkillGraph: "Language skill graph",
  Lesson: "Lesson",
  LessonSentence: "Lesson sentence",
  LessonSource: "Lesson citations",
  LessonWord: "Lesson word",
  MediaAsset: "Media asset",
  Organization: "Brand",
  Product: "Product",
  ProductRelease: "Product release",
  Sentence: "Sentence",
  Skill: "Skill",
  Source: "Source",
  SourceChangeNotice: "Source notice",
  Step: "Screen",
  StepSource: "Screen citations",
  StepVariant: "Screen version",
  TargetCutoff: "Target cutoff",
  TutorSharedAnswer: "Shared tutor answer",
  WarmUp: "Warm-up",
  Word: "Word",
  WordPronunciation: "Pronunciation guide",
};

function PictureLink({ mediaAssetId }: { mediaAssetId: string }) {
  return (
    <Link className="hit-area relative underline" href={`/media/${mediaAssetId}`}>
      See the picture
    </Link>
  );
}

function ChangeBody({
  change,
  compact,
  names,
}: {
  change: StoredChange;
  compact: boolean;
  names: Names;
}) {
  return change.model === "ItemSet" ? (
    <ItemSetChange change={change} />
  ) : (
    <OperationChange change={change} compact={compact} names={names} />
  );
}

function ItemSetChange({ change }: { change: Extract<StoredChange, { model: "ItemSet" }> }) {
  return (
    <>
      <p>
        {change.op === "replace"
          ? "Replaces the whole set for future practice; open sessions keep their copy."
          : "Restores the original set for future practice."}
      </p>
      <AdminJson label="Before" value={change.before} />
      <AdminJson label="After" value={change.after} />
    </>
  );
}

function OperationChange({
  change,
  compact,
  names,
}: {
  change: Exclude<StoredChange, { model: "ItemSet" }>;
  compact: boolean;
  names: Names;
}) {
  const fieldChanges = (fields: readonly FieldChange[]) =>
    fields.map((field) => (
      <FieldChanges
        compact={compact}
        field={field}
        key={field.field}
        model={change.model}
        names={names}
      />
    ));

  switch (change.op) {
    case "setChapters":
    case "setLessons":
    case "setSkills":
    case "setPrerequisites":
      return change.fields.map((field) => (
        <CollectionChange
          field={field}
          isOrdered={change.op === "setChapters" || change.op === "setLessons"}
          key={field.field}
          names={names}
        />
      ));
    case "setCategories":
    case "setGraph":
    case "setOptions":
    case "setCitation":
      return fieldChanges(change.fields);
    case "set":
      return (
        <>
          {fieldChanges(change.fields)}
          <Restored change={change} />
        </>
      );
    case "replace":
      return (
        <>
          <p className="text-sm">
            Retires this question and asks a corrected copy,{" "}
            <span className="font-mono text-xs">{change.replacementId}</span>, with these changes.
          </p>
          {fieldChanges(change.fields)}
        </>
      );
    case "restore":
      return (
        <p className="text-sm">
          Puts this question back in new practice and retires its replacement,{" "}
          <span className="font-mono text-xs">{change.retires}</span>.
        </p>
      );
    case "retire":
      return <p className="text-sm">Takes this question out of new practice.</p>;
    case "unretire":
      return <p className="text-sm">Puts this question back in new practice.</p>;
    case "revoice":
      return <p className="text-sm">Records a new clip of “{change.text}”.</p>;
    case "restoreClip":
      return <Restored change={change} />;
    case "detachPicture":
      return (
        <p className="text-sm">
          Takes the picture off this screen. Other screens that show it keep it.{" "}
          <PictureLink mediaAssetId={change.mediaAssetId} />
        </p>
      );
    case "attachPicture":
      return (
        <p className="text-sm">
          Puts the picture back on this screen. <PictureLink mediaAssetId={change.mediaAssetId} />
        </p>
      );
    default:
      return null;
  }
}

/**
 * jsdiff reads the clock for its time limit, which Next.js refuses while it prerenders a prefetch.
 * `compact` shows only the values that change, without each JSON field's whole before and after.
 */
export async function ContentFixChanges({
  compact = false,
  fix,
}: {
  compact?: boolean;
  fix: Pick<ContentFixDetail, "changes" | "names" | "rowLabels">;
}) {
  await connection();

  return (
    <ul className="flex flex-col gap-6">
      {fix.changes.map((change) => (
        <li className="flex flex-col gap-1" key={`${rowKeyOf(change)}:${change.op}`}>
          <h3 className="text-sm font-medium">
            {fix.rowLabels.get(rowKeyOf(change)) ?? MODEL_LABELS[change.model]}
          </h3>
          <ChangeBody change={change} compact={compact} names={fix.names} />
        </li>
      ))}
    </ul>
  );
}
