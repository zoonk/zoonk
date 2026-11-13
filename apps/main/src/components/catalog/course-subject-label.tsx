import { getCategories } from "@/lib/categories/category";
import { Eyebrow } from "@zoonk/learn/eyebrow";
import { type Subject } from "@zoonk/learn/subject-label";

export async function CourseSubjectLabel({ subject }: { subject: Subject }) {
  const categories = await getCategories();
  const label = categories.find((category) => category.key === subject)?.label;

  return label ? <Eyebrow>{label}</Eyebrow> : null;
}
