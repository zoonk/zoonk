import { LINK_CLASS } from "@/lib/link-class";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import { RestoredClip } from "./content-fix-voice";

function RestoredPicture({ change }: { change: StoredChange }) {
  const restored = "picture" in change ? change.picture.after : null;

  if (!restored) {
    return null;
  }

  return restored.imageUrl ? (
    <p className="text-sm">
      Puts back the picture it had before.{" "}
      <a className={LINK_CLASS} href={restored.imageUrl}>
        See the picture
      </a>
    </p>
  ) : (
    <p className="text-sm">Puts back the outline without a picture, as it was before.</p>
  );
}

/** What a revert puts back as it was, with nothing recorded or drawn again. */
export function Restored({ change }: { change: StoredChange }) {
  return (
    <>
      <RestoredClip change={change} />
      <RestoredPicture change={change} />
    </>
  );
}
