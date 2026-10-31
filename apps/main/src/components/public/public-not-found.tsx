import { NotFoundMessage } from "./not-found-message";
import { PublicPage } from "./public-page";

export function PublicNotFound() {
  return (
    <PublicPage className="flex flex-col">
      <NotFoundMessage />
    </PublicPage>
  );
}
