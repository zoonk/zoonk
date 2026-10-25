import { CategoryCoursesPage, getCategoryPageMetadata } from "../category-page";

export const generateMetadata = () => getCategoryPageMetadata("exams");

export default function CategoryCourses() {
  return <CategoryCoursesPage category="exams" />;
}
