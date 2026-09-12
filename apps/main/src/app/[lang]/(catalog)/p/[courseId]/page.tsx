import { redirect } from "@/i18n/navigation";
import { getCourseById } from "@zoonk/core/courses/get-by-id";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { robots: { follow: false, index: false } };

async function PersonalCourseRedirect({ params }: PageProps<"/[lang]/p/[courseId]">) {
  const { courseId, lang: locale } = await params;

  if (!isUuid(courseId)) {
    notFound();
  }

  const course = await getCourseById({ courseId });

  if (!course?.userId) {
    notFound();
  }

  return redirect({ href: `/b/me/c/${course.slug}`, locale });
}

export default function PersonalCoursePage(props: PageProps<"/[lang]/p/[courseId]">) {
  return (
    <Suspense>
      <PersonalCourseRedirect {...props} />
    </Suspense>
  );
}
