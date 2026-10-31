import { countOpenReviewFlags } from "@/data/review-flags/list-review-flags";
import Link from "next/link";

export async function ReviewFlagNotice({
  target,
}: {
  target: { itemId: string } | { lessonId: string };
}) {
  const open = await countOpenReviewFlags(target);

  if (open === 0) {
    return null;
  }

  return (
    <p className="bg-warning/10 text-warning rounded-md px-3 py-2 text-sm" role="status">
      A source this was built on changed after it was written ({open} open{" "}
      {open === 1 ? "flag" : "flags"}).{" "}
      <Link className="font-medium underline" href="/review-flags" prefetch={false}>
        Needs review
      </Link>
    </p>
  );
}
