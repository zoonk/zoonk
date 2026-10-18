import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("languages");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="languages" />;
}
