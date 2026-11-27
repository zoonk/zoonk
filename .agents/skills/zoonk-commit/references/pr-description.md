# The PR description

Describe the concrete problem and resulting behavior for a reviewer who has not seen the conversation. Keep it brief; include a trigger or before/after example when useful. Rewrite the title and body around the final implementation if the scope changes. Omit conversational history.

For each piece the PR adds or redraws (a component, a part of a screen, a rule), name where the product already does the same thing, or write "none found" with what you searched ([find the piece](../../zoonk-design/SKILL.md#find-the-piece-before-you-build-one)). Reviewers compare the two.

List under **Judgment calls** every call you made instead of asking (what you chose, in a line, and why) and every departure from a rule (the screen or code, the rule, what shipped instead and why), so the user can keep or overrule each one ([make the call](../../../../AGENTS.md#scope-and-completion), [when a rule looks wrong](../../../guides/exceptions.md)).

End with a short **Verification** section that tells the reviewer what was proven and what wasn't, in plain language rather than command lists or logs:

- For user-facing changes, the [persona walkthroughs](../../zoonk-persona-walkthrough/SKILL.md): which personas, which journeys including bad-day paths, what they exposed and what changed.
- The regression tests added for problems found, and the suites that matter for the change, with their results.
- What remains unverified.

For multiline bodies, use a structured tool argument or write the exact text to a temporary file and pass `gh ... --body-file <path>`.

## Show the change

A reviewer sees what the change did without running it, from evidence of both sides measured the same way: numbers for something faster or lighter, screenshots for anything a learner sees, a video for something that moves or takes several steps, a preview link for a blog post. Capture the before side first, before you edit.

- [Show the change](show-the-change.md): what each kind of change shows, how to report numbers, and how few pictures make it clear.
- [Capturing screens](capture.md): `pnpm pr:capture`, steps for a screen behind taps, videos, and the native apps.
- [The picture gate](picture-gate.md): what `pnpm pr:media check` holds every picture to before the body goes up.

## New commits on an open PR

After pushing commits to a PR that already exists, read its live title and body and update them in the same step when the new commits change what a reviewer would read there: the behavior or scope, what must happen before merging, open decisions, the verification (new results, or results the change made stale), or what the before and after show (capture the after side again). Edit the live text rather than an earlier copy, so others' edits survive. Keep the description about the PR as it now stands, not a log of commits. Leave it alone when a commit changes none of that, such as a typo or lint fix.
