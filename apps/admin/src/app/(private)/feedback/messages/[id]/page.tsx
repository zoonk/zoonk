import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getFeedbackMessage } from "@/data/feedback/get-feedback-message";
import { capitalize, formatDateTime } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { feedbackStatusLabels, getLearnerLabel } from "../../_utils/feedback-labels";
import { type FeedbackMessage, MessageDetail } from "./message-detail";
import { MessageStatusForm } from "./message-status-form";

export const metadata: Metadata = { title: "Feedback message" };

const MESSAGE_PARENTS = [{ href: "/feedback/messages", label: "Feedback" }];

export default function FeedbackMessagePage({ params }: PageProps<"/feedback/messages/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<MessageDetailSkeleton />}>
        <MessageDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

function getMessageTitle({ email, user }: FeedbackMessage): string {
  const sender = user ? getLearnerLabel(user) : email;
  return sender ? `Message from ${sender}` : "Message";
}

async function MessageDetailContent({
  params,
}: Pick<PageProps<"/feedback/messages/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const message = await getFeedbackMessage(id);

  if (!message) {
    notFound();
  }

  return (
    <>
      <AdminDetailHeader
        actions={<MessageStatusForm currentStatus={message.status} messageId={message.id} />}
        facts={[
          feedbackStatusLabels[message.status],
          `Sent ${formatDateTime(message.createdAt)}`,
          message.context.platform && capitalize(message.context.platform),
        ]}
        parents={MESSAGE_PARENTS}
        title={getMessageTitle(message)}
      />

      <AdminDetailBody>
        <MessageDetail message={message} />
      </AdminDetailBody>
    </>
  );
}

function MessageDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="buttons" parents={MESSAGE_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton>
          <div className="flex max-w-3xl flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </AdminSectionSkeleton>
        <AdminSectionSkeleton rows={7} />
      </AdminDetailBody>
    </>
  );
}
