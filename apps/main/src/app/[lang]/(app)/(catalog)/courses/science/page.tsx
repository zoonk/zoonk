import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("science");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="science" />;
}
