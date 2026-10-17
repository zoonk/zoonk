"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { getLessonWritingHref } from "@/lib/lessons/lesson-writing-href";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps, useEffect, useRef, useState, useTransition } from "react";

const LESSON_PATH = /^\/learn\/(?<lessonId>[\da-f-]{36})$/u;

/**
 * Only lessons not known to be written ask for writing before navigation. Prefetches only read.
 * While that request is out, the link dims, so the tap shows it was taken before the wait opens.
 */
export function LearningLink({
  className,
  lessonWritten = false,
  onNavigate,
  ...props
}: ComponentProps<typeof Link> & { lessonWritten?: boolean }) {
  const router = useRouter();
  const opening = useRef(false);
  const mounted = useRef(true);
  const [requesting, setRequesting] = useState(false);
  const [navigating, startTransition] = useTransition();
  const pending = requesting || navigating;

  async function openLesson(lessonId: string) {
    const openedFrom = globalThis.location.pathname + globalThis.location.search;

    try {
      const answer = await askToWriteLesson(lessonId);

      if (
        mounted.current &&
        openedFrom === globalThis.location.pathname + globalThis.location.search
      ) {
        startTransition(() => router.push(getLessonWritingHref({ answer, lessonId })));
      }
    } finally {
      opening.current = false;
      setRequesting(false);
    }
  }

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <Link
      {...props}
      aria-busy={pending || undefined}
      className={cn(className, "aria-busy:cursor-progress aria-busy:opacity-60")}
      onNavigate={(event) => {
        const cancellation = { prevented: false };

        onNavigate?.({
          preventDefault: () => {
            cancellation.prevented = true;
            event.preventDefault();
          },
        });

        if (cancellation.prevented) {
          return;
        }

        const lessonId = LESSON_PATH.exec(props.href)?.groups?.lessonId;

        if (!lessonId || lessonWritten) {
          return;
        }

        event.preventDefault();

        if (opening.current || pending) {
          return;
        }

        opening.current = true;
        setRequesting(true);
        void openLesson(lessonId);
      }}
    />
  );
}
