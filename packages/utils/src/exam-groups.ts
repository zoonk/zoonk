export type GroupedSubject = { group?: string | null; otherGroups?: readonly string[] | null };

/** Every test or block that asks the subject: its `group` first, then the others the notice names. */
export function listSubjectGroups(subject: GroupedSubject): string[] {
  return [...new Set([subject.group, ...(subject.otherGroups ?? [])])].filter(
    (name): name is string => typeof name === "string" && name.trim().length > 0,
  );
}

export function isInPart({
  part,
  subject,
}: {
  part: string;
  subject: GroupedSubject & { name: string };
}): boolean {
  return subject.name === part || listSubjectGroups(subject).includes(part);
}
