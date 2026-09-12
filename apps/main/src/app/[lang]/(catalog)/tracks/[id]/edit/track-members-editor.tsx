"use client";

import { type TrackUpdateInput } from "@zoonk/core/courses/track-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";

export type TrackMember = {
  id: string;
  title: string;
  target: NonNullable<TrackUpdateInput["members"]>[number];
};

function TrackMemberRow({
  index,
  member,
  onMove,
  onRemove,
  pending,
  ref,
  total,
}: {
  index: number;
  member: TrackMember;
  onMove: (index: number, offset: number) => void;
  onRemove: (index: number) => void;
  pending: boolean;
  ref: React.Ref<HTMLLIElement>;
  total: number;
}) {
  const t = useExtracted();

  return (
    <li
      className="focus-visible:ring-ring flex items-center gap-1 rounded-xl py-2 outline-none focus-visible:ring-2"
      ref={ref}
      tabIndex={-1}
    >
      <span className="min-w-0 flex-1 pr-2 text-sm">{member.title}</span>
      <Button
        aria-label={t("Move {course} up", { course: member.title })}
        className="size-11 shrink-0"
        disabled={pending || index === 0}
        onClick={() => onMove(index, -1)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ArrowUpIcon />
      </Button>
      <Button
        aria-label={t("Move {course} down", { course: member.title })}
        className="size-11 shrink-0"
        disabled={pending || index === total - 1}
        onClick={() => onMove(index, 1)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ArrowDownIcon />
      </Button>
      <Button
        aria-label={t("Remove {course} from track", { course: member.title })}
        className="size-11 shrink-0"
        disabled={pending || total === 1}
        onClick={() => onRemove(index)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </li>
  );
}

export function TrackMembersEditor({
  availableCourses,
  members,
  onChange,
  pending,
}: {
  availableCourses: { id: string; title: string }[];
  members: TrackMember[];
  onChange: (members: TrackMember[]) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const rowsRef = useRef(new Map<string, HTMLLIElement>());
  const [focusTarget, setFocusTarget] = useState<string>();
  const [announcement, setAnnouncement] = useState("");

  const available = availableCourses.filter(
    (course) => !members.some((selected) => selected.id === course.id),
  );

  useEffect(() => {
    if (focusTarget && members.some((member) => member.id === focusTarget)) {
      rowsRef.current.get(focusTarget)?.focus();
    }
  }, [focusTarget, members]);

  function move(index: number, offset: number) {
    const next = [...members];
    const item = next.splice(index, 1)[0];

    if (!item) {
      return;
    }

    next.splice(index + offset, 0, item);
    setFocusTarget(item.id);
    onChange(next);

    setAnnouncement(
      t("{course} moved to position {position, number}.", {
        course: item.title,
        position: index + offset + 1,
      }),
    );
  }

  function removeMember(index: number) {
    const item = members[index];

    if (!item) {
      return;
    }

    setFocusTarget(members[index + 1]?.id ?? members[index - 1]?.id);
    onChange(members.filter((member) => member.id !== item.id));
    setAnnouncement(t("{course} removed from this track.", { course: item.title }));
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-medium">{t("Course order")}</h2>
      <ol className="divide-border divide-y">
        {members.map((member, index) => (
          <TrackMemberRow
            index={index}
            key={member.id}
            member={member}
            onMove={move}
            onRemove={removeMember}
            pending={pending}
            ref={(node) => {
              if (node) {
                rowsRef.current.set(member.id, node);
              } else {
                rowsRef.current.delete(member.id);
              }
            }}
            total={members.length}
          />
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {available.length > 0 && (
        <Select
          items={available.map((course) => ({ label: course.title, value: course.id }))}
          onValueChange={(id) => {
            const course = available.find((item) => item.id === id);

            if (course) {
              onChange([...members, { ...course, target: { courseId: course.id } }]);
            }
          }}
          value={null}
        >
          <SelectTrigger aria-label={t("Add a course")} className="min-h-11" disabled={pending}>
            <SelectValue placeholder={t("Add a course")} />
          </SelectTrigger>
          <SelectContent>
            {available.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="text-muted-foreground text-sm">
        {t(
          "Removing a course from this track preserves your learning progress. Courses you've started stay in My Courses.",
        )}
      </p>
    </div>
  );
}
