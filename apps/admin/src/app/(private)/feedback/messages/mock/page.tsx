// Review pack only: the feedback list with each message's first line (the decision's first option).
import { Lead, MockList, MockViews, readView } from "@/app/(private)/_mock/kit";
import { formatDate } from "@/lib/format";
import { prisma } from "@zoonk/db";
import { connection } from "next/server";
import { parseFeedbackMessageContext } from "@/data/feedback/_utils/feedback-message-context";
import { feedbackStatusLabels, getFeedbackPlatform, getFeedbackSubject } from "../../_utils/feedback-labels";

export default async function FeedbackTextMockPage({
  searchParams,
}: PageProps<"/feedback/messages/mock">) {
  await connection();
  const all = readView((await searchParams).status) === "all";

  const messages = await prisma.feedback.findMany({
    include: { user: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: all ? {} : { status: "new" },
  });

  const waiting = await prisma.feedback.count({ where: { status: "new" } });

  return (
    <MockList
      columns={[
        { label: "Message" },
        ...(all ? [{ label: "State" }] : []),
        { label: "About", size: "text" as const },
        { label: "App", size: "wide" as const },
        { label: "Sent" },
      ]}
      rows={messages.map((message) => {
        const context = parseFeedbackMessageContext(message.context);
        const subject = getFeedbackSubject(context);

        return [
          <Lead
            key="lead"
            second={[message.user?.name, message.email].filter(Boolean).join(" · ") || "Unknown sender"}
            title={<span className="line-clamp-1">{message.message}</span>}
          />,
          ...(all ? [feedbackStatusLabels[message.status]] : []),
          <span className="block" key="about">
            {subject}
            {context.screen && context.screen !== subject ? (
              <span className="block text-xs">Sent from the {context.screen} screen</span>
            ) : null}
          </span>,
          getFeedbackPlatform(context) ?? "—",
          formatDate(message.createdAt),
        ];
      })}
      title="Feedback"
      toolbar={
        <MockViews
          label="Messages"
          views={[
            { active: !all, count: waiting, label: "New" },
            { label: "Read" },
            { label: "Replied" },
            { active: all, label: "All" },
          ]}
        />
      }
    />
  );
}
