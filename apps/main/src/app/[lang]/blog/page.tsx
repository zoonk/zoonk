import { BLOG_URL } from "@zoonk/utils/url";
import { redirect } from "next/navigation";

export const ensureStatic = "navigation";

export default function BlogPage() {
  redirect(BLOG_URL);
}
