import { getCategories } from "@/lib/categories/category";
import { type Subject, SubjectLabel } from "@zoonk/learn/subject-label";

/**
 * A course's subject named over its title, on a soft tint of its color (`SubjectLabel`); nothing for
 * a course in no category Zoonk knows, whose general color has no name to show.
 */
export async function CourseSubjectLabel({ subject }: { subject: Subject }) {
  const categories = await getCategories();
  const label = categories.find((category) => category.key === subject)?.label;

  return label ? <SubjectLabel subject={subject}>{label}</SubjectLabel> : null;
}
