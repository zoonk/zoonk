import { NotFoundMessage } from "@/components/public/not-found-message";
import { PublicPage } from "@/components/public/public-page";

/**
 * A page that called `notFound()` keeps the public top bar and footer and says what happened in
 * plain words, instead of the framework's bare 404.
 */
export default function NotFound() {
  return (
    <PublicPage className="flex flex-col">
      <NotFoundMessage />
    </PublicPage>
  );
}
