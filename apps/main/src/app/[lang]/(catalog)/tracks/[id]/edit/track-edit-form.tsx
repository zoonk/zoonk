"use client";

import { runClientAction } from "@/lib/client-action";
import { type TrackResource } from "@zoonk/core/courses/tracks";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { removeTrack, updateTrack } from "../track-actions";
import { type TrackMember, TrackMembersEditor } from "./track-members-editor";

function trackMembers(track: TrackResource): TrackMember[] {
  const members = [
    ...track.courses.map((course) => ({
      id: course.id,
      position: course.position,
      target: { courseId: course.id },
      title: course.title,
    })),
    ...track.pendingCourses.map((course) => ({
      id: course.coursePromptId,
      position: course.position,
      target: { coursePromptId: course.coursePromptId },
      title: course.title,
    })),
  ];

  return members.toSorted((a, b) => a.position - b.position);
}

export function TrackEditForm({
  availableCourses,
  track,
}: {
  availableCourses: { id: string; title: string }[];
  track: TrackResource;
}) {
  const t = useExtracted();
  const language = useLocale();
  const titleId = useId();
  const [title, setTitle] = useState(track.title);
  const [members, setMembers] = useState(() => trackMembers(track));
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const hadConfirmation = useRef(false);

  useEffect(() => {
    if (confirmRemove || hadConfirmation.current) {
      removeButtonRef.current?.focus();
    }

    hadConfirmation.current = confirmRemove;
  }, [confirmRemove]);

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          setFailed(false);

          startTransition(async () =>
            setFailed(
              Boolean(
                await runClientAction(
                  () =>
                    updateTrack({
                      input: { members: members.map((member) => member.target), title },
                      language,
                      trackId: track.id,
                    }),
                  { status: "unavailable" as const },
                ),
              ),
            ),
          );
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={titleId}>{t("Track name")}</Label>
          <Input
            disabled={pending}
            id={titleId}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </div>
        <TrackMembersEditor
          availableCourses={availableCourses}
          members={members}
          onChange={setMembers}
          pending={pending}
        />
        <Button
          aria-busy={pending}
          className="min-h-11 w-fit"
          disabled={pending || members.length === 0}
          type="submit"
        >
          {pending && <Spinner aria-hidden="true" />}
          {t("Save changes")}
        </Button>
      </form>
      {confirmRemove ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {t(
              "Remove this track? Courses you've started and your learning progress will stay in My Courses.",
            )}
          </p>
          <div className="flex gap-3">
            <Button
              aria-busy={pending}
              disabled={pending}
              onClick={() => {
                setFailed(false);

                startTransition(async () =>
                  setFailed(
                    Boolean(
                      await runClientAction(() => removeTrack({ language, trackId: track.id }), {
                        status: "unavailable" as const,
                      }),
                    ),
                  ),
                );
              }}
              variant="destructive"
              ref={removeButtonRef}
            >
              {pending && <Spinner aria-hidden="true" />}
              {t("Remove track")}
            </Button>
            <Button disabled={pending} onClick={() => setConfirmRemove(false)} variant="outline">
              {t("Cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="w-fit"
          disabled={pending}
          onClick={() => {
            setFailed(false);
            setConfirmRemove(true);
          }}
          variant="ghost"
          ref={removeButtonRef}
        >
          {t("Remove track")}
        </Button>
      )}
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't save this change. Your changes are still here. Try again.")}
        </p>
      )}
    </div>
  );
}
