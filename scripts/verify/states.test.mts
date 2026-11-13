/* oxlint-disable no-magic-numbers -- The fixtures are layout in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Moved, type Place } from "./states-probe.mts";
import { type Step, stateLeads } from "./states.mts";

function at(top: number, overrides: Partial<Place> = {}): Place {
  return { height: 36, left: 16, top, width: 120, ...overrides };
}

function change(label: string, before: Place, after: Place, overrides: Partial<Moved> = {}): Moved {
  return {
    after,
    before,
    carried: false,
    drawn: true,
    holds: false,
    isTarget: false,
    label,
    ...overrides,
  };
}

function step(kind: Step["action"]["kind"], moved: Moved[], target: Place | null = at(100)): Step {
  return {
    action: { id: "0", kind, label: 'button "Username"' },
    blocked: false,
    comparison: { moved, target },
    doing: "typing a character in",
  };
}

describe("what a step moved", () => {
  it("leads to a neighbor pushed by a hint, with the action and the pixels", () => {
    const [jump, ...rest] = stateLeads([
      step("field", [change('button "Save"', at(444), at(459))]),
    ]);

    assert.deepEqual(rest, []);
    assert.equal(jump?.check, "X3 a state change moves nothing");
    assert.equal(jump?.value, 15);

    assert.equal(
      jump?.message,
      'typing a character in button "Username": button "Save" moved 15 px down',
    );
  });

  it("leads to a control that changes size, and not to plain boxes that only grew around it", () => {
    const busy = change('button "Listen"', at(0, { width: 78 }), at(0, { width: 82 }));
    const wrapper = change("div", at(0, { width: 300 }), at(0, { width: 304 }), { drawn: false });

    assert.match(
      stateLeads([step("control", [busy, wrapper])])[0]?.message ?? "",
      /from 78×36 to 82×36 px$/u,
    );
  });

  it("leaves what went along with a parent that moved, and 1 px of rounding", () => {
    const carried = change('span "Save"', at(444), at(459), { carried: true });
    const rounding = change('button "Save"', at(444), at(445));

    assert.deepEqual(stateLeads([step("field", [carried, rounding])]), []);
  });

  it("leaves the boxes holding what was acted on, which grow with what appeared in them", () => {
    const form = change("form", at(0, { height: 200 }), at(0, { height: 216 }), { holds: true });

    assert.deepEqual(stateLeads([step("field", [form])]), []);
  });

  it("lets a fold push what's under it straight down, but not what's beside or above it", () => {
    const under = change('p "Under the fold"', at(200), at(280));
    const beside = change('button "Next"', at(100, { left: 200 }), at(100, { left: 210 }));
    const above = change('h1 "Plan"', at(40), at(52));

    assert.deepEqual(stateLeads([step("fold", [under])]), []);

    assert.match(
      stateLeads([step("fold", [under, beside, above])])[0]?.message ?? "",
      /"Next" moved 10 px right; h1 "Plan" moved 12 px down$/u,
    );
  });

  it("lets a search field change the list under it", () => {
    const list = change('div "All countries"', at(560), at(170));

    assert.deepEqual(stateLeads([step("search", [list])]), []);
  });

  it("says when what moved is a failed save, since the walk blocks every write", () => {
    const column = change('section "How much do you already know?"', at(81), at(125));

    assert.match(
      stateLeads([{ ...step("pick", [column]), blocked: true }])[0]?.message ?? "",
      /moved 44 px down \(the walk blocked its save, so this is a failed save\)$/u,
    );
  });

  it("names three things and counts the rest", () => {
    const moved = [1, 2, 3, 4, 5].map((index) =>
      change(`row ${index}`, at(index * 50), at(index * 50 + 12)),
    );

    assert.match(
      stateLeads([step("pick", moved)])[0]?.message ?? "",
      /row 3 moved 12 px down and 2 more$/u,
    );
  });
});
