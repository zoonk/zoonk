"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { Spinner } from "@zoonk/ui/components/spinner";
import { EllipsisIcon, ListXIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useActionState } from "react";
import { type RemoveCurrentUserCourseState, removeCurrentUserCourseAction } from "./actions";

const INITIAL_REMOVE_COURSE_STATE: RemoveCurrentUserCourseState = { status: "idle" };

/**
 * Keeps the destructive library action behind a familiar overflow menu and
 * explains the progress-preservation contract before the learner confirms it.
 */
export function RemoveCourseMenu({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const t = useExtracted();

  const [state, formAction, isPending] = useActionState(
    removeCurrentUserCourseAction,
    INITIAL_REMOVE_COURSE_STATE,
  );

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("More options for {courseTitle}", { courseTitle })}
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <EllipsisIcon aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <AlertDialogTrigger
            nativeButton={false}
            render={<DropdownMenuItem variant="destructive" />}
            role="menuitem"
          >
            <ListXIcon aria-hidden="true" />
            {t("Remove from My Courses")}
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Remove {courseTitle}?", { courseTitle })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("The course will disappear from My Courses. Your progress will be kept.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.status === "error" && (
          <p className="text-destructive text-sm" role="alert">
            {t("We couldn't remove this course. Please try again.")}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t("Cancel")}</AlertDialogCancel>

          <form action={formAction} className="contents">
            <input name="courseId" type="hidden" value={courseId} />
            <AlertDialogAction disabled={isPending} type="submit" variant="destructive">
              {isPending && <Spinner />}
              {isPending ? t("Removing...") : t("Remove course")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
