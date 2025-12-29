import { ContainerHeader } from "@zoonk/ui/components/container";
import {
  ImageUploadActionButton,
  ImageUploadLoading,
  ImageUploadOverlay,
  ImageUploadPlaceholder,
  ImageUploadProvider,
  ImageUploadRemoveButton,
  ImageUploadTrigger,
} from "@zoonk/ui/components/image-upload";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { getCourse } from "@/data/courses/get-course";
import { removeCourseImageAction, uploadCourseImageAction } from "./actions";

export async function CourseImage({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: course, error } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (error || !course) {
    return notFound();
  }

  const routeParams = { courseId: course.id, courseSlug, lang, orgSlug };

  return (
    <ContainerHeader>
      <ImageUploadProvider
        currentImageUrl={course.imageUrl}
        onRemove={removeCourseImageAction.bind(null, routeParams)}
        onUpload={uploadCourseImageAction.bind(null, routeParams)}
      >
        <ImageUploadTrigger
          aria-label={
            course.imageUrl
              ? t("Change course image")
              : t("Upload course image")
          }
        >
          {course.imageUrl ? (
            <Image
              alt=""
              className="object-cover transition-opacity group-hover:opacity-80"
              fill
              sizes="96px"
              src={course.imageUrl}
            />
          ) : (
            <ImageUploadPlaceholder>
              <ImageIcon />
            </ImageUploadPlaceholder>
          )}

          <ImageUploadOverlay>
            <ImageUploadActionButton>
              <UploadIcon />
            </ImageUploadActionButton>

            <ImageUploadRemoveButton aria-label={t("Remove image")}>
              <Trash2Icon />
            </ImageUploadRemoveButton>
          </ImageUploadOverlay>

          <ImageUploadLoading />
        </ImageUploadTrigger>
      </ImageUploadProvider>
    </ContainerHeader>
  );
}
