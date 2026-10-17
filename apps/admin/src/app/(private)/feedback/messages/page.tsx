import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { FeedbackViewsNav } from "../feedback-views-nav";
import { MessageList, MessageListSkeleton, MessageStatusFilter } from "./message-list";

export const metadata: Metadata = { title: "Feedback Messages" };

export default function FeedbackMessagesPage({ searchParams }: PageProps<"/feedback/messages">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Feedback Messages</ContainerTitle>
          <ContainerDescription>
            Messages from the feedback form, with the page and content they were sent from.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <FeedbackViewsNav current="/feedback/messages" />

        <Suspense fallback={<Skeleton className="h-7 w-64" />}>
          <MessageStatusFilter searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<MessageListSkeleton />}>
          <MessageList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
