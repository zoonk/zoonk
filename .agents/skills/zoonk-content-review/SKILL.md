---
name: zoonk-content-review
description: Review the content Zoonk generated in production over a window (plans, exam blueprints, skill graphs, courses, lessons, items, words), as the learner who got it would, against the sources it came from. Propose content fixes for what's wrong and start a fix thread for each cause in our code. Use for the weekly content review, or when asked to audit recent production content.
license: MIT
metadata:
  author: zoonk
  version: "1.1.0"
---

# Review production content

Generated content can be wrong while every check passes: a fact check drops a true fact, a planner falls back to a default, a field stays null, and no error fires. Learners see it before we do. This review reads what production made, finds what's wrong or missing, fixes that content, and fixes the code so it stops happening.

Read [zoonk-staff-data](../zoonk-staff-data/SKILL.md) first: it's how you read production and propose fixes, and its rules on learner data and on running one staff command at a time hold for every step here.

## Window

Review content created in the 7 days before the run, unless the brief names another window. Count each model's new rows first (`staff count <Model> --where "createdAt gte …"`) and report those counts, so a quiet week and a broken pipeline look different.

## What to review, in order

What a learner builds on comes first, because one wrong blueprint or plan spreads into everything made from it.

1. **Every new goal and what it produced:** its plan and plan items, and for an exam its blueprint, cutoffs, skill graph and mock; for a language, its skill graph and level. Read it as that learner: does the plan fit the goal, the deadline and the study time? Does the exam look like the real one (sections, days, item counts, written tasks, scoring, penalties, cutoffs)?
2. **Every new shared structure:** exam blueprints, skill graphs, courses with their chapters and lesson lists, target cutoffs, warm-ups.
3. **Lessons, items, words and sentences:** too many to read all of. Check all of them for the structural problems below with narrow queries, then read in full:
   - every lesson or item a learner flagged or asked about in the window (`Feedback`, `LessonQuestion`, `ContentReviewFlag`) and every lesson whose `LessonQualityDecision` blocked or kept minor issues;
   - questions most learners got wrong in `Attempt` (often a wrong answer key);
   - a sample across kinds (language, exam, general, code), languages and courses, weighted toward what learners opened.
4. **Missing work:** content that should exist by now and doesn't, such as a goal without plan items, a plan item without its lesson, a lesson without screens, a media asset never made, or a `FollowUp` with `failedAt` set or long overdue.

Take model and field names from `staff models`, never from memory or the code: production may run another schema.

## What counts as wrong

- **Not true:** a fact, date, number, law, answer key, translation, pronunciation or worked step that's wrong.
- **Dropped or defaulted:** a null that the source states, an empty list, a count that disagrees with its parts or the source, the same default value across unrelated rows.
- **Inconsistent:** a title that doesn't match its content, totals that don't add up, one fact told two ways.
- **Wrong for the learner:** the wrong level, language, country or exam edition.
- **Reads badly:** leaked prompt text, placeholders, raw markup, a screen repeated, the wrong language mid-lesson, a picture or clip missing or not matching its text.
- **Personal data in shared content:** a learner's own details in a shared lesson, skill or course.

Judge against the source, not your memory: the official notice, law or document the content cites (`Source`, `LessonSource`, `StepSource`) or the current official page. A claim you can't confirm is a question, not a finding.

## Find the cause

For each finding, find why it happened before deciding anything. Read the code that made it on `origin/main`: the task and its prompt, its checks and the pipeline around them ([AI package](../../../packages/ai/AGENTS.md), [core](../../../packages/core/AGENTS.md)). The row's `AiCall` (by `runId` or `goalId`) gives the task and prompt version, and its `traceId` finds the model's own output in PostHog's AI traces: whether the model got it wrong, or got it right and our code dropped or changed it, decides where the fix goes.

Then sort it:

- **A one-off model slip** (the code and prompt are sound): fix the content.
- **A cause in our code, prompt, check or data:** it will happen again. Fix the cause, and fix the content it already made.

Group findings that share a cause; one cause is one fix however many rows it touched. Check `git log origin/main` and open PRs first: the cause may already be fixed and not yet released (`gh release list`), and then only the content made before the release needs fixing.

## Act

- **Content:** propose every content fix of the run as one batch with `pnpm zoonk staff fixes propose` ([propose a fix](../zoonk-staff-data/references/propose-a-fix.md)), after checking `ContentFix` for a proposal already waiting on the same rows. When a code fix will regenerate the content after its release, leave that content to the fix's after-release work instead of fixing it by hand.
- **Code:** for each cause, look for an open issue, PR or thread already on it (`gh issue list`, `gh pr list`, `t3_thread_search`). When none is, start a thread in its own worktree from `origin/main`, titled `Fix content: <the cause in a few words>`. Brief it with the evidence (what's wrong, how many rows of which models, the code path and the suspected cause), and tell it to confirm the cause first, follow the repository's AGENTS.md through a ready pull request, add the eval case or test that would have caught it, and fix the content already made, by an after-release trigger when a regeneration does it. When your harness can't start threads, list each cause with its evidence in your report.

Briefs and threads stay on this machine, so they may name shared content (a lesson, a blueprint, an exam) by id. A learner's own data still goes in no brief, issue or PR: describe it by counts and shapes.

## Report

End with a short report:

- what you reviewed: each model's count in the window, and how much of each you read in full;
- each finding, grouped by cause, with what a learner saw and how many rows it touched;
- the fix batch's `reviewUrl`, for a staff person to approve in Admin;
- each fix thread started, and each existing issue, PR or thread a finding joined;
- what you couldn't check, and why.

A week with nothing wrong reports the counts and what was read, then says so in one line.
