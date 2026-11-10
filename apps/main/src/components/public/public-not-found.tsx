import { NotFoundMessage } from "./not-found-message";
import { PublicPage } from "./public-page";

export function PublicNotFound({ exploreLinks }: { exploreLinks?: boolean }) {
  return (
    <PublicPage className="flex flex-col" exploreLinks={exploreLinks}>
      <NotFoundMessage />
    </PublicPage>
  );
}
