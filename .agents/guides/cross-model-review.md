# Cross-model review

Some models over-engineer, and a reviewer from another family catches the bugs, clutter and simpler approaches the author misses. So a PR with any code change beyond a typo or a small, obvious fix gets one adversarial review from the other model family before it's marked ready.

1. Ask yourself first: "Am I over-engineering this? Is there a simpler way to do it?"
2. Start a subagent from the other family, with the model and effort [models](models.md) sets for code review. Give it the request, the diff, the existing code the PR names as doing the same thing and the checkout to run it in, with the running app's URL when there is one, but not your reasoning.
3. It tries to break the change and reports only what it can show ([evidence before findings](../skills/zoonk-code-review/SKILL.md#evidence-before-findings)): a reviewer that only reads the code drifts into style notes and guards for paths nobody reaches. Fix what holds up.

- **Once per PR,** on the whole branch: never after each lane, fix batch or review comment. A later fix is covered by its own checks and by the PR's reviewers, which run again on each push.
- **The agent that opens the PR runs it,** so a subagent that hands its work to a lead leaves it to the lead.
- **One family available:** use a fresh agent of that family, given only the request and the diff, and say so in the handoff. Otherwise a review command that runs on the builder's own family doesn't count as this review.
- The design and security reviews a change needs run at the same time, each in its own agent ([verify](../skills/verify/SKILL.md#5-review-it-as-a-principal-engineer-a-security-researcher-and-a-designer)).
