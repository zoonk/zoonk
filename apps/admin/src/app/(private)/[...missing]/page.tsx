import { notFound } from "next/navigation";

/** An address no page answers opens the Admin's own "Nothing here", inside its frame. */
export default function MissingPage() {
  notFound();
}
