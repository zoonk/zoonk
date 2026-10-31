import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { LiveCallSections, LiveCallSectionsSkeleton } from "./live-call-sections";

export const metadata: Metadata = { title: "Live calls" };

/** Nothing here is cached: the switch and the open connections must be what reserve sees now. */
export default function LiveCallsPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Live calls</ContainerTitle>
          <ContainerDescription>
            Who can start a voice call, what free accounts can spend on calls each day, and the
            connections still open.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-10">
        <Suspense fallback={<LiveCallSectionsSkeleton />}>
          <LiveCallSections />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
