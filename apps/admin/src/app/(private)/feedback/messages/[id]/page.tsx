import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminSectionSkeleton } from "@/components/admin-section";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessageDetail } from "./message-detail";

export const metadata: Metadata = { title: "Feedback Message" };

export default function FeedbackMessagePage({ params }: PageProps<"/feedback/messages/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb
            current="Message"
            parents={[
              { href: "/feedback", label: "Feedback" },
              { href: "/feedback/messages", label: "Messages" },
            ]}
          />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="mx-auto w-full max-w-4xl gap-8">
        <Suspense fallback={<MessageDetailSkeleton />}>
          <MessageDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function MessageDetailContent({
  params,
}: Pick<PageProps<"/feedback/messages/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return <MessageDetail id={id} />;
}

function MessageDetailSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
