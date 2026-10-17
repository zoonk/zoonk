import {
  Container,
  ContainerAction,
  ContainerActions,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { AudioLinesIcon } from "lucide-react";
import { type Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MediaFilters, MediaFiltersSkeleton } from "./media-filters";
import { MediaList, MediaListSkeleton } from "./media-list";

export const metadata: Metadata = { title: "Media" };

/** Images and audio made once and reused, with the prompt and style that made them. */
export default function MediaPage({ searchParams }: PageProps<"/media">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Media</ContainerTitle>
          <ContainerDescription>
            Generated images and audio, reused by reuse key across lesson screens.
          </ContainerDescription>
        </ContainerHeaderGroup>

        <ContainerActions>
          <ContainerAction
            icon={AudioLinesIcon}
            render={<Link href="/media/missing-audio" prefetch />}
          >
            Missing audio
          </ContainerAction>
        </ContainerActions>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<MediaFiltersSkeleton />}>
          <MediaFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<MediaListSkeleton />}>
          <MediaList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
