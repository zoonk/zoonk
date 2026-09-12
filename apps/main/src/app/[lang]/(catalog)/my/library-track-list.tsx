"use client";

import { Link } from "@/i18n/navigation";
import { type listCurrentUserTracks } from "@zoonk/core/courses/tracks";
import { Button } from "@zoonk/ui/components/button";
import {
  ListItem,
  ListItemContent,
  ListItemDescription,
  ListItemIcon,
  ListItemTitle,
} from "@zoonk/ui/components/list";
import { Spinner } from "@zoonk/ui/components/spinner";
import { LayersIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { loadMoreTracks } from "./actions";

type Page = Extract<Awaited<ReturnType<typeof listCurrentUserTracks>>, { status: "ready" }>;

export function LibraryTrackList({ initialPage }: { initialPage: Page }) {
  const t = useExtracted();
  const [page, setPage] = useState(initialPage);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <>
      {page.tracks.map((track) => (
        <ListItem className="gap-0 p-0" key={track.id}>
          <Link
            className="focus-visible:ring-ring/50 hover:bg-muted flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl px-4 py-3 outline-none focus-visible:ring-2"
            href={`/tracks/${track.id}`}
          >
            <ListItemIcon>
              <LayersIcon aria-hidden="true" />
            </ListItemIcon>
            <ListItemContent>
              <ListItemTitle>{track.title}</ListItemTitle>
              <ListItemDescription>
                {t("Track · {count, plural, one {# course} other {# courses}}", {
                  count: track.progress.totalCourses,
                })}
              </ListItemDescription>
            </ListItemContent>
          </Link>
        </ListItem>
      ))}
      {page.nextCursor && (
        <Button
          aria-busy={pending}
          className="min-h-11 w-fit"
          disabled={pending}
          onClick={() => {
            const cursor = page.nextCursor;

            if (!cursor) {
              return;
            }

            setFailed(false);

            startTransition(async () => {
              const next = await loadMoreTracks(cursor);

              if (next.status === "ready") {
                setPage({
                  ...next,
                  tracks: [
                    ...page.tracks,
                    ...next.tracks.filter(
                      (track) => !page.tracks.some((existing) => existing.id === track.id),
                    ),
                  ],
                });
              } else {
                setFailed(true);
              }
            });
          }}
          variant="outline"
        >
          {pending && <Spinner aria-hidden="true" />}
          {t("More tracks")}
        </Button>
      )}
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't load more tracks. Please try again.")}
        </p>
      )}
    </>
  );
}
