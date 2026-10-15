import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("culture");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="culture" />;
}
