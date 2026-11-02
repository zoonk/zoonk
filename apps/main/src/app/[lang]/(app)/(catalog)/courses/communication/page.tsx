import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("communication");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="communication" />;
}
