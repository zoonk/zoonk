import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("business");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="business" />;
}
