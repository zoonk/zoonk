/**
 * The private store's top folders: a private course's pictures and uploads, each with one folder
 * per learner (`{folder}/{userId}/`). Spoken answers are never stored.
 */
export const PRIVATE_FILE_FOLDERS = ["images", "sources"] as const;

type PrivateFileFolder = (typeof PRIVATE_FILE_FOLDERS)[number];

function getUserFolder({ folder, userId }: { folder: PrivateFileFolder; userId: string }) {
  return `${folder}/${userId}/`;
}

/** Uploads live under the owner's folder, so a learner can only register their own files. */
export function getSourceUploadFolder(userId: string): string {
  return getUserFolder({ folder: "sources", userId });
}

/** A private course's pictures live under its owner's folder, like everything else only they see. */
export function getPrivateImageFolder(userId: string): string {
  return getUserFolder({ folder: "images", userId });
}

/** Every folder of private files one learner owns, removed when their account is deleted. */
export function getUserBlobFolders(userId: string): string[] {
  return PRIVATE_FILE_FOLDERS.map((folder) => getUserFolder({ folder, userId }));
}

/** A file directly inside the folder, whose name can't climb out of it. */
export function isFileInFolder({ folder, pathname }: { folder: string; pathname: string }) {
  const fileName = pathname.slice(folder.length);

  return (
    pathname.startsWith(folder) &&
    fileName.length > 0 &&
    !fileName.includes("/") &&
    !fileName.includes("..")
  );
}

/** Whether the file sits in one of the learner's own folders, so only they may read it. */
export function isOwnPrivateFile({ pathname, userId }: { pathname: string; userId: string }) {
  return getUserBlobFolders(userId).some((folder) => isFileInFolder({ folder, pathname }));
}

const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

/** The pathname of a file in a private Blob store, or null for any other URL, such as a public file. */
export function getPrivateBlobPathname(url: string): string | null {
  if (!URL.canParse(url)) {
    return null;
  }

  const { hostname, pathname } = new URL(url);

  return hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX) ? decodeURIComponent(pathname.slice(1)) : null;
}

/**
 * Where main serves a learner's own files: on its own origin, so the browser sends the session
 * cookie with an image request.
 */
export const OWN_FILES_WEB_PATH = "/api/files";

/**
 * The address a client reads a stored file from: a public file's CDN URL as it is, and a private
 * file's path on an app's authenticated file route (`{baseUrl}/{folder}/{ownerId}/{name}`), since a
 * private Blob URL only opens with the store's credentials.
 */
export function toOwnFileUrl({ baseUrl, url }: { baseUrl: string; url: string }): string {
  const pathname = getPrivateBlobPathname(url);

  if (!pathname) {
    return url;
  }

  return `${baseUrl}/${pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
