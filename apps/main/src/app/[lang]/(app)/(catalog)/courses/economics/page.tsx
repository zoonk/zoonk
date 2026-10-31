import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("economics");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="economics" />;
}
