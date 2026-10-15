import { PublicNotFound } from "@/components/public/public-not-found";

/** A page that isn't there, shown by the browser where a page threw `notFound()`. */
export default function NotFound() {
  return <PublicNotFound />;
}
