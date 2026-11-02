import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("law");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="law" />;
}
