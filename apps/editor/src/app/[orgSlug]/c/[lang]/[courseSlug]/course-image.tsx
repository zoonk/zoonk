import { getCourse } from "@/data/courses/get-course";
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
import {
  BYTES_PER_MB,
  DEFAULT_IMAGE_ACCEPTED_TYPES,
  DEFAULT_IMAGE_MAX_SIZE,
} from "@zoonk/utils/constants";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
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
  const maxSizeMB = DEFAULT_IMAGE_MAX_SIZE / BYTES_PER_MB;
  const acceptedFormats = DEFAULT_IMAGE_ACCEPTED_TYPES.map((type) =>
    type.replace("image/", "").toUpperCase(),
  ).join(", ");

  return (
    <ContainerHeader>
      <ImageUploadProvider
        currentImageUrl={course.imageUrl}
        messages={{
          invalidType: t("Invalid file type. Please upload a {formats} image.", {
            formats: acceptedFormats,
          }),
          removeSuccess: t("Image removed"),
          tooLarge: t("File is too large. Maximum size is {max}MB.", {
            max: String(maxSizeMB),
          }),
          uploadSuccess: t("Image uploaded"),
        }}
        onRemove={removeCourseImageAction.bind(null, routeParams)}
        onUpload={uploadCourseImageAction.bind(null, routeParams)}
      >
        <ImageUploadTrigger
          aria-label={course.imageUrl ? t("Change course image") : t("Upload course image")}
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
