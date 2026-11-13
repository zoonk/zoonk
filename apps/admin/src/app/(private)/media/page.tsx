import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { countMissingAudio } from "@/data/media/list-missing-audio";
import { Button } from "@zoonk/ui/components/button";
import { MicOffIcon } from "lucide-react";
import { type Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MediaFilters, MediaFiltersSkeleton } from "./media-filters";
import { MediaList, MediaListSkeleton } from "./media-list";

export const metadata: Metadata = { title: "Media" };

/** The count has a set width, so the button is the same size before and after it loads. */
const COUNT_CLASS =
  "text-muted-foreground inline-block min-w-[2ch] text-end font-mono tabular-nums";

async function MissingAudioCount() {
  "use cache: private";

  const missing = await countMissingAudio();

  return <span className={COUNT_CLASS}>{missing.toLocaleString("en")}</span>;
}

export default function MediaPage({ searchParams }: PageProps<"/media">) {
  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <Button
            icon={<MicOffIcon aria-hidden="true" />}
            render={<Link href="/media/missing-audio" prefetch />}
            size="bar"
            variant="outline"
          >
            Missing audio
            <Suspense fallback={<span className={COUNT_CLASS} />}>
              <MissingAudioCount />
            </Suspense>
          </Button>
        }
        title="Media"
      />

      <AdminPageBody>
        <Suspense fallback={<MediaFiltersSkeleton />}>
          <MediaFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<MediaListSkeleton />}>
          <MediaList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
