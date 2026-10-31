import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("society");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="society" />;
}
