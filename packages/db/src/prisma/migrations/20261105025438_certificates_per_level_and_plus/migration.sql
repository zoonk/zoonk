-- A placement test no longer certifies a level.
DELETE FROM "certificates" WHERE "kind" = 'placement';

-- AlterEnum
BEGIN;
CREATE TYPE "CertificateKind_new" AS ENUM ('course', 'language_level');
ALTER TABLE "certificates" ALTER COLUMN "kind" TYPE "CertificateKind_new" USING ("kind"::text::"CertificateKind_new");
ALTER TYPE "CertificateKind" RENAME TO "CertificateKind_old";
ALTER TYPE "CertificateKind_new" RENAME TO "CertificateKind";
DROP TYPE "public"."CertificateKind_old";
COMMIT;

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "course_level" "CourseLevel",
ADD COLUMN     "issued_at" TIMESTAMP(3);

