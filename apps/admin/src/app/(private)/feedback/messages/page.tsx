import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { MessageFilter, MessageList, MessageListSkeleton } from "./message-list";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackMessagesPage({ searchParams }: PageProps<"/feedback/messages">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Feedback" />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<Skeleton className="h-7.5 w-64" />}>
            <MessageFilter searchParams={searchParams} />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<MessageListSkeleton />}>
          <MessageList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
