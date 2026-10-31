import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("engineering");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="engineering" />;
}
