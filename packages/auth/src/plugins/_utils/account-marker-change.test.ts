import { describe, expect, it } from "vitest";
import { getAccountMarkerChange } from "./account-marker-change";

const ACCOUNT = { isAnonymous: false };
const GUEST = { isAnonymous: true };

describe(getAccountMarkerChange, () => {
  it("sets the marker for every new account session, even over an old one", () => {
    expect(getAccountMarkerChange({ endsSession: false, hasMarker: false, newUser: ACCOUNT })).toBe(
      "set",
    );

    expect(getAccountMarkerChange({ endsSession: false, hasMarker: true, newUser: ACCOUNT })).toBe(
      "set",
    );
  });

  it("clears a leftover marker when a guest session starts, and leaves none alone", () => {
    expect(getAccountMarkerChange({ endsSession: false, hasMarker: true, newUser: GUEST })).toBe(
      "clear",
    );

    expect(
      getAccountMarkerChange({ endsSession: false, hasMarker: false, newUser: GUEST }),
    ).toBeNull();
  });

  it("clears the marker when the session ends (sign-out, deletion)", () => {
    expect(getAccountMarkerChange({ endsSession: true, hasMarker: true, newUser: null })).toBe(
      "clear",
    );

    expect(
      getAccountMarkerChange({ endsSession: true, hasMarker: false, newUser: null }),
    ).toBeNull();
  });

  it("repairs the marker when a browser checks its session", () => {
    const check = (checkedUser: typeof ACCOUNT | null, hasMarker: boolean) =>
      getAccountMarkerChange({ checkedUser, endsSession: false, hasMarker, newUser: null });

    expect(check(ACCOUNT, false)).toBe("set");
    expect(check(ACCOUNT, true)).toBeNull();
    expect(check(GUEST, true)).toBe("clear");
    expect(check(GUEST, false)).toBeNull();
    expect(check(null, true)).toBe("clear");
  });

  it("leaves the marker alone on responses that don't touch the session", () => {
    expect(
      getAccountMarkerChange({ endsSession: false, hasMarker: true, newUser: null }),
    ).toBeNull();
  });
});
