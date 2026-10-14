import { describe, expect, it } from "vitest";
import { getShownEndMove } from "./end-move";

const restDay = {
  endDateAfter: "2027-11-12",
  endDateBefore: "2027-11-13",
  lessonsAdded: 4,
  lessonsRemoved: 227,
};

describe(getShownEndMove, () => {
  it("leaves out an end that moves a day beside lessons that leave or come", () => {
    expect(getShownEndMove(restDay)).toBeNull();
    expect(getShownEndMove({ ...restDay, lessonsAdded: 0 })).toBeNull();
    expect(getShownEndMove({ ...restDay, lessonsRemoved: 0 })).toBeNull();
  });

  it("says an end that moves more than a day beside lessons that change", () => {
    expect(getShownEndMove({ ...restDay, endDateAfter: "2027-11-11" })).toStrictEqual({
      after: "2027-11-11",
      before: "2027-11-13",
    });
  });

  it("says an end that moves a day when it's all the change moves", () => {
    expect(getShownEndMove({ ...restDay, lessonsAdded: 0, lessonsRemoved: 0 })).toStrictEqual({
      after: "2027-11-12",
      before: "2027-11-13",
    });
  });

  it("says nothing when the end stays or a date is missing", () => {
    expect(getShownEndMove({ ...restDay, endDateAfter: "2027-11-13" })).toBeNull();
    expect(getShownEndMove({ ...restDay, endDateBefore: null })).toBeNull();
    expect(getShownEndMove(null)).toBeNull();
  });
});
