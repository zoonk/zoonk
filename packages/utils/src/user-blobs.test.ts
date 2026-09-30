import { describe, expect, it } from "vitest";
import { getPrivateBlobPathname, isOwnPrivateFile, toOwnFileUrl } from "./user-blobs";

const USER_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";
const PRIVATE_STORE = "https://abc123.private.blob.vercel-storage.com";
const PUBLIC_STORE = "https://abc123.public.blob.vercel-storage.com";

describe(isOwnPrivateFile, () => {
  it("accepts a file directly in any of the learner's folders", () => {
    expect(isOwnPrivateFile({ pathname: `sources/${USER_ID}/notes.pdf`, userId: USER_ID })).toBe(
      true,
    );

    expect(isOwnPrivateFile({ pathname: `images/${USER_ID}/step-a1.webp`, userId: USER_ID })).toBe(
      true,
    );
  });

  it("refuses another learner's folder, folders that aren't private and names that leave the folder", () => {
    expect(isOwnPrivateFile({ pathname: `images/${USER_ID}0/a.webp`, userId: USER_ID })).toBe(
      false,
    );

    expect(isOwnPrivateFile({ pathname: `library/${USER_ID}/a.webp`, userId: USER_ID })).toBe(
      false,
    );

    expect(isOwnPrivateFile({ pathname: `speech/${USER_ID}/take.webm`, userId: USER_ID })).toBe(
      false,
    );

    expect(isOwnPrivateFile({ pathname: `images/${USER_ID}/`, userId: USER_ID })).toBe(false);

    expect(isOwnPrivateFile({ pathname: `images/${USER_ID}/nested/a.webp`, userId: USER_ID })).toBe(
      false,
    );

    expect(
      isOwnPrivateFile({ pathname: `images/${USER_ID}/../other/a.webp`, userId: USER_ID }),
    ).toBe(false);
  });
});

describe(getPrivateBlobPathname, () => {
  it("reads the pathname of a private store's file, decoded", () => {
    expect(getPrivateBlobPathname(`${PRIVATE_STORE}/sources/${USER_ID}/My%20notes.pdf`)).toBe(
      `sources/${USER_ID}/My notes.pdf`,
    );
  });

  it("ignores public files and anything that isn't a URL", () => {
    expect(getPrivateBlobPathname(`${PUBLIC_STORE}/library/images/step-a1.webp`)).toBeNull();
    expect(getPrivateBlobPathname("/fallback.png")).toBeNull();
  });
});

describe(toOwnFileUrl, () => {
  it("points a private file at the app's file route, one encoded segment each", () => {
    expect(
      toOwnFileUrl({
        baseUrl: "https://api.zoonk.test/v1/files",
        url: `${PRIVATE_STORE}/sources/${USER_ID}/My%20notes%23.pdf`,
      }),
    ).toBe(`https://api.zoonk.test/v1/files/sources/${USER_ID}/My%20notes%23.pdf`);
  });

  it("keeps a public file's CDN URL", () => {
    const url = `${PUBLIC_STORE}/library/images/step-a1.webp`;

    expect(toOwnFileUrl({ baseUrl: "/api/files", url })).toBe(url);
  });
});
