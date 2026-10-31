import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("math");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="math" />;
}
