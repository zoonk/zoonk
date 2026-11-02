import { getCategories } from "@/lib/categories/category";
import { type Subject, SubjectLabel } from "@zoonk/learn/subject-label";

export async function CourseSubjectLabel({ subject }: { subject: Subject }) {
  const categories = await getCategories();
  const label = categories.find((category) => category.key === subject)?.label;

  return label ? <SubjectLabel subject={subject}>{label}</SubjectLabel> : null;
}
