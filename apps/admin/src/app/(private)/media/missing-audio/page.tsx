import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
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
import { MissingAudioList, MissingAudioListSkeleton } from "./missing-audio-list";

export const metadata: Metadata = { title: "Missing audio" };

/** The repair queue for Library language lessons: upload a clip for any word or sentence without one. */
export default function MissingAudioPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Missing audio" parents={[{ href: "/media", label: "Media" }]} />
          <ContainerTitle>Missing audio</ContainerTitle>
          <ContainerDescription>
            Words and sentences in Library lessons without audio. Audio is shared per language, so
            one upload fixes every lesson that uses it.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<MissingAudioListSkeleton />}>
          <MissingAudioList />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
