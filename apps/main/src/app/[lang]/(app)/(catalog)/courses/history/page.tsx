import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("history");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="history" />;
}
