import { NotFoundMessage } from "./not-found-message";
import { PublicPage } from "./public-page";

/**
 * A public page that isn't there keeps the public top bar and footer and says what happened in
 * plain words, instead of the framework's bare 404.
 */
export function PublicNotFound() {
  return (
    <PublicPage className="flex flex-col">
      <NotFoundMessage />
    </PublicPage>
  );
}
