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
} from "@zoonk/ui/components/alert-dialog";
import { useExtracted } from "next-intl";
import { createContext, use, useState } from "react";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";

/**
 * Leaves the lesson, or asks first when the screen holds an answer the learner wrote and hasn't
 * checked (`unsentAnswer`). Returns whether it left.
 */
type LeaveLesson = () => boolean;

const LessonLeaveContext = createContext<LeaveLesson | null>(null);

export function useLeaveLesson(): LeaveLesson {
  const leave = use(LessonLeaveContext);

  if (!leave) {
    throw new Error("useLeaveLesson must be used within a LessonLeaveProvider");
  }

  return leave;
}

/**
 * The way out of a lesson, shared by the ✕ and Escape. Leaving drops a written answer that wasn't
 * checked (its text lives only on the screen), so then it asks first, as an essay does; any other
 * screen leaves at once, its answers already saved.
 */
export function LessonLeaveProvider({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const { screen } = useLessonPlayer();
  const { onExit } = useLessonPlayerConfig();
  const [asking, setAsking] = useState(false);

  const leave = () => {
    if (screen.unsentAnswer) {
      setAsking(true);
      return false;
    }

    onExit();
    return true;
  };

  return (
    <LessonLeaveContext value={leave}>
      {children}

      <AlertDialog onOpenChange={setAsking} open={asking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Leave for now?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Your answer hasn't been checked, so it won't be kept.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep writing")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAsking(false);
                onExit();
              }}
            >
              {t("Leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LessonLeaveContext>
  );
}
