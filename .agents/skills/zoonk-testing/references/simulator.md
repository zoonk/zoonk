# Learner simulator

`packages/core/src/plans/_test-utils/sim/` runs explicit learner lives through the real planner functions. The fast pure simulator composes placement, study, missed days, base choices, outline landings and refreshes around those functions. It loads its fixture library once from the configured test database; simulated steps use no AI or database writes.

A life (`SimLife`) specifies its fixture, starting day, study time, pace, known areas, pending outlines and steps. `runSimLife(life, { check })` requires the rule to check after each step and returns its violations. There is no generated batch or default set of checks.

The in-suite consumers are `most-asked-kept.test.ts`, `most-asked-cuts.test.ts` and `base-choice-topics.test.ts`; `planner/local-mock-move.test.ts` also uses the simulator's creation and change helpers. Run the relevant existing test through the normal core Vitest command and isolated test database.

The retained oracles live in `_test-utils/rules/`: day, keep, steering, work and most-asked rules, with `rule-context`, `rule-items` and `rule-fixtures` supporting them. Their tests and product tests import the individual checks. `RULES.md` remains the owner's planning specification.

`sim-claims.ts` builds the learner evidence the planner reads from simulated study, placement answers and choices. Plans carry the known-skill set from their latest build (`SimPlan.knownSkillIds`), so answers after a run affect the next build. A day's first planning run is `newDay`. Placement uses the exam's choice format. Simulated pace comes from the learner's own pace; `sim-db-pace.ts` separately retains the `keepPaceOwn` helper used by real database tests.

The composition in `sim-planner`, `sim-change`, `sim-refresh`, `sim-create` and `sim-listening-starts` models what capabilities do around their reads. A change in the real composition does not automatically change this model. Confirm a finding through the real capability and keep its regression test at the smallest boundary that reproduces the defect.

`sim/fixtures/class-test.json` holds a cell-biology class test's Library content, rebuilt from a persona's notes. It contains no learner data.
