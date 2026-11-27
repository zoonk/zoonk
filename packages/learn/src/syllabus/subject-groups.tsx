import { type ReactNode } from "react";
import { ListGroup } from "../_components/list-group";
import { groupSubjects } from "./group-subjects";
import { SubjectGroupHeading } from "./syllabus-notes";
import { type SyllabusSectionSubject, type SyllabusSectionView } from "./syllabus-section-view";

export function SubjectGroups<Subject extends SyllabusSectionSubject>({
  renderSubject,
  syllabus,
  titleId,
}: {
  renderSubject: (subject: Subject) => ReactNode;
  syllabus: Pick<SyllabusSectionView, "examDocument" | "hasNotice" | "kind"> & {
    subjects: readonly Subject[];
  };
  titleId: string;
}) {
  const groups = groupSubjects(syllabus.subjects, { modules: syllabus.kind === "modules" });

  return (
    <div className="divided-rows flex flex-col">
      {groups.map((group, index) => {
        const groupId = `${titleId}-group-${index}`;

        return (
          <div key={group.extra ? "extra" : (group.name ?? "all")}>
            <SubjectGroupHeading group={group} id={groupId} syllabus={syllabus} />

            <ListGroup
              as="ul"
              aria-labelledby={group.extra || group.name ? groupId : titleId}
              className="block"
            >
              {group.subjects.map((subject) => (
                <li key={subject.key}>{renderSubject(subject)}</li>
              ))}
            </ListGroup>
          </div>
        );
      })}
    </div>
  );
}
