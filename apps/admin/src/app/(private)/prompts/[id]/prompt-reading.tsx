import { AdminJson } from "@/components/admin-json";
import { AdminSectionEmpty } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { type PromptOutcome } from "@/data/prompts/_utils/prompt-outcomes";
import { type AdminPrompt } from "@/data/prompts/get-prompt";
import { type GoalUnderstandingView } from "@zoonk/core/view-models/onboarding/contract";
import { parsePromptReading } from "../_utils/prompt-labels";

type GoalsReading = Extract<GoalUnderstandingView, { status: "goals" }>;

function getGoalFacts(draft: GoalsReading["goals"][number]["draft"]) {
  return [
    draft.kind,
    draft.targetLanguage ? `${draft.language} → ${draft.targetLanguage}` : draft.language,
    draft.targetDate && `by ${draft.targetDate}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getScheduleFacts(schedule: GoalsReading["schedule"]) {
  return [`${schedule.dailyMinutes} min a day`, schedule.studyTime, schedule.studyTimeNote]
    .filter(Boolean)
    .join(" · ");
}

function UnderstoodGoals({ reading }: { reading: GoalsReading }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y">
        {reading.goals.map(({ draft }) => (
          <li className="flex flex-col gap-0.5 py-2 text-sm" key={`${draft.kind}:${draft.title}`}>
            <span className="font-medium">{draft.title}</span>
            <span className="text-muted-foreground text-xs">{getGoalFacts(draft)}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">{getScheduleFacts(reading.schedule)}</p>
    </div>
  );
}

function ReadingBody({ prompt }: { prompt: AdminPrompt }) {
  const reading = parsePromptReading(prompt.understanding);

  if (reading?.status === "goals") {
    return <UnderstoodGoals reading={reading} />;
  }

  if (reading?.status === "explain") {
    return (
      <DetailFields>
        <DetailField label="Question">{reading.question}</DetailField>
      </DetailFields>
    );
  }

  if (reading?.status === "instrument") {
    return (
      <DetailFields>
        <DetailField label="Instrument">{reading.instrument}</DetailField>
      </DetailFields>
    );
  }

  return <AdminSectionEmpty>{readingNotes[prompt.outcome]}</AdminSectionEmpty>;
}

const OLDER_FORMAT_NOTE = "This reading is in an older format. Open the stored reading below.";

const readingNotes: Record<PromptOutcome, string> = {
  failed: "The words couldn't be read.",
  goalCreated: OLDER_FORMAT_NOTE,
  inProgress: "Still reading the words.",
  noGoal: OLDER_FORMAT_NOTE,
  unclear: "Too vague to plan. The learner was asked to say more.",
  unsafe: "Declined as unsafe.",
};

export function PromptReading({ prompt }: { prompt: AdminPrompt }) {
  return (
    <div className="flex flex-col gap-1">
      <ReadingBody prompt={prompt} />
      <AdminJson label="Stored reading" value={prompt.understanding} />
    </div>
  );
}
