import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { StateMark } from "@/components/state-mark";
import { listUserMessages } from "@/data/users/list-user-messages";
import { formatDate } from "@/lib/format";
import { MessageSquareTextIcon, MessagesSquareIcon } from "lucide-react";
import { type Route } from "next";
import Link from "next/link";
import { feedbackStatusLabels, getFeedbackSubject } from "../../feedback/_utils/feedback-labels";

type Written = {
  date: Date;
  href: Route;
  id: string;
  kind: "feedback" | "question";
  note: React.ReactNode;
  text: string;
};

/** Each kind wears its page's icon: a message to us, or a question to their buddy. */
const KIND_ICONS = { feedback: MessageSquareTextIcon, question: MessagesSquareIcon };

/** What they wrote to us and asked their buddy, newest first, each opening its own page. */
export async function UserMessages({ userId }: { userId: string }) {
  "use cache: private";

  const { feedback, questions } = await listUserMessages(userId);

  const rows: Written[] = [
    ...feedback.map((message) => ({
      date: message.createdAt,
      href: `/feedback/messages/${message.id}` as Route,
      id: message.id,
      kind: "feedback" as const,
      note:
        message.status === "new" ? (
          <StateMark state="new">{feedbackStatusLabels.new}</StateMark>
        ) : (
          feedbackStatusLabels[message.status]
        ),
      text: message.message.split("\n")[0] ?? getFeedbackSubject(message.context),
    })),
    ...questions.map((question) => ({
      date: question.createdAt,
      href: `/questions/${question.id}` as Route,
      id: question.id,
      kind: "question" as const,
      note: "Asked their buddy",
      text: question.question,
    })),
  ].toSorted((first, second) => second.date.getTime() - first.date.getTime());

  return (
    <AdminSection title="What they wrote">
      {rows.length === 0 ? (
        <AdminSectionEmpty>No feedback or buddy questions.</AdminSectionEmpty>
      ) : (
        <ul className="-my-2.5 flex flex-col divide-y">
          {rows.map((row) => {
            const Icon = KIND_ICONS[row.kind];

            return (
              <li key={row.id}>
                <Link
                  className="hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2.5 flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 outline-none focus-visible:ring-[3px]"
                  href={row.href}
                  prefetch
                >
                  <Icon
                    aria-hidden="true"
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-2 text-sm text-pretty">{row.text}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(row.date)} · {row.note}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminSection>
  );
}
