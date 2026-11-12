import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { listUserMessages } from "@/data/users/list-user-messages";
import { formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import { feedbackStatusLabels, getFeedbackSubject } from "../../feedback/_utils/feedback-labels";

const FEEDBACK_COLUMNS: AdminTableColumn[] = [
  { label: "Sent" },
  { label: "About" },
  { label: "State" },
];

const QUESTION_COLUMNS: AdminTableColumn[] = [{ label: "Asked" }, { label: "Question" }];

/** What they wrote to us and asked their buddy: the last few, each opening its own page. */
export async function UserMessages({ userId }: { userId: string }) {
  "use cache: private";

  const { feedback, questions } = await listUserMessages(userId);

  return (
    <>
      <AdminSection title="Feedback">
        <AdminTableColumns
          columns={FEEDBACK_COLUMNS}
          emptyLabel="No feedback messages."
          isEmpty={feedback.length === 0}
        >
          {feedback.map((message) => (
            <AdminTableRow key={message.id}>
              <TableCell>
                <AdminTableRowLink href={`/feedback/messages/${message.id}`}>
                  {formatDate(message.createdAt)}
                </AdminTableRowLink>
              </TableCell>
              <TableCell>{getFeedbackSubject(message.context)}</TableCell>
              <TableCell className="text-muted-foreground">
                {feedbackStatusLabels[message.status]}
              </TableCell>
            </AdminTableRow>
          ))}
        </AdminTableColumns>
      </AdminSection>

      <AdminSection title="Buddy questions">
        <AdminTableColumns
          columns={QUESTION_COLUMNS}
          emptyLabel="No questions asked."
          isEmpty={questions.length === 0}
        >
          {questions.map((question) => (
            <AdminTableRow key={question.id}>
              <TableCell className="text-muted-foreground">
                {formatDate(question.createdAt)}
              </TableCell>
              <TableCell className="max-w-xl">
                <AdminTableRowLink className="block truncate" href={`/questions/${question.id}`}>
                  {question.question}
                </AdminTableRowLink>
              </TableCell>
            </AdminTableRow>
          ))}
        </AdminTableColumns>
      </AdminSection>
    </>
  );
}
