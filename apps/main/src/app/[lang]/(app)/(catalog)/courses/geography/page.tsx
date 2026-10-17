import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("geography");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="geography" />;
}
