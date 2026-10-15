import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("arts");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="arts" />;
}
