"use client";

import {
  type ProfileQuestionView,
  type ProfileQuestionsView,
} from "@zoonk/core/profile/questions/contract";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
} from "../_components/notice-card";
import {
  PageSection,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { LearnLink } from "../learn-link";
import { type ProfileQuestion } from "./profile-draft";

const GROUPS = [
  { id: "day", questions: ["work", "tools", "studies"] },
  { id: "fun", questions: ["watch", "listen", "play", "read", "activities"] },
  { id: "learn", questions: ["conditions", "learningSupport"] },
] as const satisfies { id: string; questions: ProfileQuestion[] }[];

type GroupId = (typeof GROUPS)[number]["id"];

export function aboutYouQuestionHref(question: ProfileQuestion): string {
  return `/settings/about-you/${question}`;
}

function GroupTitle({ group }: { group: GroupId }) {
  const t = useExtracted();

  switch (group) {
    case "day":
      return t("Your day");
    case "fun":
      return t({
        description: "A group of questions about the learner's hobbies and interests.",
        message: "For fun",
      });
    case "learn":
      return t("How you learn");
    default:
      return group satisfies never;
  }
}

function QuestionName({ question }: { question: ProfileQuestion }) {
  const t = useExtracted();

  switch (question) {
    case "work":
      return t("What you do now");
    case "tools":
      return t("Apps and tools");
    case "studies":
      return t("What you've studied");
    case "watch":
      return t({ description: "What the learner likes to watch.", message: "Watch" });
    case "listen":
      return t({ description: "What the learner likes to listen to.", message: "Listen" });
    case "play":
      return t({ description: "What the learner likes to play.", message: "Play" });
    case "read":
      return t({ description: "What the learner likes to read.", message: "Read" });
    case "activities":
      return t({ description: "What the learner likes to do for fun.", message: "Do" });
    case "conditions":
      return t({
        description: "Health conditions or disabilities the learner chose to save.",
        message: "Conditions",
      });
    case "learningSupport":
      return t("What helps you learn");
    default:
      return question satisfies never;
  }
}

function labelsOf(question: ProfileQuestionView, ids: readonly string[]): string[] {
  return ids.map((id) => question.options.find((option) => option.id === id)?.label ?? id);
}

/** What's saved, short: conditions only count, so the list is safe on a shared screen. */
function useSavedSummary(question: ProfileQuestionView): string {
  const t = useExtracted();
  const { picks, studies, text } = question.saved;

  if (picks.length === 0 && studies.length === 0 && text === "") {
    if (question.status === "declined") {
      return t("Not shared");
    }

    return question.status === "answered"
      ? t({ description: "Invites the learner to fill in an empty answer.", message: "Add" })
      : t("Not answered");
  }

  switch (question.id) {
    case "conditions":
      return t("{count, plural, one {# saved} other {# saved}}", { count: picks.length });
    case "work":
      return text || labelsOf(question, picks).join(", ");
    case "studies":
      return studies.map((study) => study.subject ?? labelsOf(question, [study.field])[0]).join(", ");
    case "learningSupport":
      return labelsOf(question, picks).join(", ") || text;
    case "tools":
    case "watch":
    case "listen":
    case "play":
    case "read":
    case "activities":
      return [labelsOf(question, picks).join(", "), text].filter(Boolean).join(" · ");
    default:
      return question.id satisfies never;
  }
}

function QuestionRow({ editable, question }: { editable: boolean; question: ProfileQuestionView }) {
  const summary = useSavedSummary(question);

  const body = (
    <ListRowBody>
      <ListRowContent>
        <ListRowTitle>
          <QuestionName question={question.id} />
        </ListRowTitle>
      </ListRowContent>
      <ListRowTrailing className="max-w-[55%] truncate font-sans">{summary}</ListRowTrailing>
    </ListRowBody>
  );

  return editable ? (
    <ListRowLink href={aboutYouQuestionHref(question.id)}>{body}</ListRowLink>
  ) : (
    <ListRow className="py-3">{body}</ListRow>
  );
}

function MemoryOffNotice() {
  const t = useExtracted();

  return (
    <NoticeCard>
      <NoticeCardContent>
        <NoticeCardDescription>
          {t(
            "Memory is off, so Zoonk isn't using your day or what you do for fun. Turn it on in Memory to change them.",
          )}
        </NoticeCardDescription>
        <NoticeCardActions>
          <LearnLink className="text-sm font-medium underline" href="/settings/memory">
            {t("Memory")}
          </LearnLink>
        </NoticeCardActions>
      </NoticeCardContent>
    </NoticeCard>
  );
}

export function AboutYouScreen({ view }: { view: ProfileQuestionsView }) {
  return (
    <div className="flex flex-col gap-7" data-slot="about-you-screen">
      {!view.memoryEnabled && <MemoryOffNotice />}

      {GROUPS.map((group) => (
        <PageSection aria-labelledby={`about-you-${group.id}`} key={group.id}>
          <PageSectionHeader>
            <PageSectionTitle id={`about-you-${group.id}`}>
              <GroupTitle group={group.id} />
            </PageSectionTitle>
          </PageSectionHeader>

          <ListGroup>
            {group.questions.map((id) => {
              const question = view.questions.find((item) => item.id === id);

              return (
                question && (
                  <QuestionRow
                    editable={view.memoryEnabled || group.id === "learn"}
                    key={id}
                    question={question}
                  />
                )
              );
            })}
          </ListGroup>
        </PageSection>
      ))}
    </div>
  );
}
