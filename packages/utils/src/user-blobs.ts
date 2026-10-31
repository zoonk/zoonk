/** Spoken answers are never stored. */
export const PRIVATE_FILE_FOLDERS = ["audio", "images", "sources"] as const;

type PrivateFileFolder = (typeof PRIVATE_FILE_FOLDERS)[number];

function getUserFolder({ folder, userId }: { folder: PrivateFileFolder; userId: string }) {
  return `${folder}/${userId}/`;
}

export function getSourceUploadFolder(userId: string): string {
  return getUserFolder({ folder: "sources", userId });
}

export function getPrivateImageFolder(userId: string): string {
  return getUserFolder({ folder: "images", userId });
}

export function getPrivateAudioFolder(userId: string): string {
  return getUserFolder({ folder: "audio", userId });
}

export function getUserBlobFolders(userId: string): string[] {
  return PRIVATE_FILE_FOLDERS.map((folder) => getUserFolder({ folder, userId }));
}

/** Directly inside the folder; a name can't climb out of it. */
export function isFileInFolder({ folder, pathname }: { folder: string; pathname: string }) {
  const fileName = pathname.slice(folder.length);

  return (
    pathname.startsWith(folder) &&
    fileName.length > 0 &&
    !fileName.includes("/") &&
    !fileName.includes("..")
  );
}

export function isOwnPrivateFile({ pathname, userId }: { pathname: string; userId: string }) {
  return getUserBlobFolders(userId).some((folder) => isFileInFolder({ folder, pathname }));
}

const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

export function getPrivateBlobPathname(url: string): string | null {
  if (!URL.canParse(url)) {
    return null;
  }

  const { hostname, pathname } = new URL(url);

  return hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX) ? decodeURIComponent(pathname.slice(1)) : null;
}

/** On main's own origin, so the browser sends the session cookie with an image request. */
export const OWN_FILES_WEB_PATH = "/api/files";

const OWN_FILES_API_PATH = "/v1/files/";

/** A media element can't send the API's bearer token, so the page reads its own origin's route. */
export function toWebOwnFileUrl(url: string): string {
  if (!URL.canParse(url)) {
    return url;
  }

  const { pathname } = new URL(url);

  return pathname.startsWith(OWN_FILES_API_PATH)
    ? `${OWN_FILES_WEB_PATH}/${pathname.slice(OWN_FILES_API_PATH.length)}`
    : url;
}

/** A private Blob URL only opens with the store's credentials, so it goes through `baseUrl`. */
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
