import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("tech");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="tech" />;
}
