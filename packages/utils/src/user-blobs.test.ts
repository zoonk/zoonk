import { describe, expect, it } from "vitest";
import {
  getPrivateBlobPathname,
  isOwnPrivateFile,
  toOwnFileUrl,
  toWebOwnFileUrl,
} from "./user-blobs";

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

    expect(isOwnPrivateFile({ pathname: `audio/${USER_ID}/it-a1.mp3`, userId: USER_ID })).toBe(
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

  it("refuses a name that a URL reads as another path", () => {
    const names = [
      String.raw`%2e%2e\%2e%2e\other\a.pdf`,
      String.raw`..\..\other\a.pdf`,
      "%2e%2e%2fother%2fa.pdf",
      "%2e%2e%5cother%5ca.pdf",
      ".%2e",
      ".\t.",
      "..",
      ".",
      "a.pdf?b",
      "a.pdf#b",
      "50% off.pdf",
    ];

    for (const name of names) {
      expect(isOwnPrivateFile({ pathname: `sources/${USER_ID}/${name}`, userId: USER_ID })).toBe(
        false,
      );
    }
  });

  it("accepts the names learners give their files", () => {
    const names = ["My notes (1).pdf", "Anotações de aula.pdf", "日本語.pdf", "v1..v2 [draft].pdf"];

    for (const name of names) {
      expect(isOwnPrivateFile({ pathname: `sources/${USER_ID}/${name}`, userId: USER_ID })).toBe(
        true,
      );
    }
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

describe(toWebOwnFileUrl, () => {
  it("serves an API file route's file from the web app's own route", () => {
    expect(toWebOwnFileUrl(`https://api.zoonk.com/v1/files/audio/${USER_ID}/it-a1.mp3`)).toBe(
      `/api/files/audio/${USER_ID}/it-a1.mp3`,
    );
  });

  it("leaves any other address as it is", () => {
    expect(toWebOwnFileUrl(`${PUBLIC_STORE}/library/audio/it.mp3`)).toBe(
      `${PUBLIC_STORE}/library/audio/it.mp3`,
    );

    expect(toWebOwnFileUrl("/catalog/chapters/cover.webp")).toBe("/catalog/chapters/cover.webp");
  });
});
