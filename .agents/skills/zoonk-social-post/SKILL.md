---
name: zoonk-social-post
description: Use when asked for a Zoonk social media post (X, LinkedIn, Instagram), a launch thread, a carousel, post copy or post images, or to review or update one.
---

# Social posts

A Zoonk post sounds like a person showing a friend something cool: what it is, what problem it solves, one concrete example. It's short, it's positive, and its picture or clip is the real app. Every post ships in English and Brazilian Portuguese.

Read [voice](references/voice.md) before drafting and [platforms](references/platforms.md) before choosing lengths, sizes and link placement. Follow [copywriting](../copywriting/SKILL.md) for copy craft and run its [AI tells](../copywriting/references/ai-tells.md) self-check on every draft; this skill only adds what is Zoonk's own.

## Workflow

1. **Find the one thing.** Read what changed: the GitHub release notes, the pull requests behind a feature, and the code and catalogs they touch. Pick the one thing a post shows, from the learner's side: what they can now do, and the problem it solves. A release gets one lead post and a few follow-ups, one feature each; it never gets a changelog.
2. **Check every claim against the code.** Labels exactly as the app shows them (the `.po` catalogs), numbers from `packages/core`, what needs Plus said plainly. When the code and a draft disagree, the code wins. Never write a feature, label or number the app doesn't have.
3. **Pick the accounts.** Zoonk's accounts (English for the world, Portuguese for Brazil) and the owner's personal account. The personal one is first person and built only from things the owner has really said or done; when a draft needs a fact you don't have, ask the owner rather than invent one.
4. **Draft each account and platform in both languages,** with the [voice](references/voice.md). Write the Portuguese as Portuguese, not a translation, with the terms the [Portuguese style guide](../../../packages/i18n/.eloqnt/styleguide.pt.md) uses. Take the example goal from what the app itself suggests in that language (`packages/learn/src/onboarding/entry/use-local-goal-example.ts`): Spanish or the SAT in English, the ENEM in Portuguese.
5. **Choose the media.** A demo clip when the point is a change (a sentence becoming a plan, a day adjusting); a still when it's one moment or one answer (what an hour covers). A launch's lead post gets a clip. Instagram gets a carousel of stills, its second slide standing alone.
6. **Make the media with the studio** ([zoonk-video](../zoonk-video/SKILL.md)): [social stills](../zoonk-video/references/social-stills.md) and [feature demos](../zoonk-video/references/feature-demo.md). Both languages, light by default, black for a launch's lead and images that are mostly large type. A screen the studio can't draw yet gets a typed view and a catalog piece; never a screenshot pasted on a ground or a redrawn screen.
7. **Check.** Every claim against the code again; each post's first line said out loud on its own; lengths and link placement against [platforms](references/platforms.md); every image at full size and at 400 px wide, in both languages; alt text that says what the picture shows, including the words in it.
8. **Store the campaign** in the private marketing repository (below). Its posts files are what the owner reviews and edits, from any device: each post as it will appear, per account and platform, with its media shown under it and one line on why it's built that way. Hand the owner the link. The owner posts; nothing goes out from an agent.
9. **After posting,** record in the campaign what went out (link, date, account) and how it did (views, likes, reposts, saves, clicks) a few days later, so the next campaign starts from evidence.

## The marketing repository

Finished assets live in the private `zoonk/marketing` repository, one folder per campaign, never in this one:

```text
<yyyy-mm>-<campaign>/              such as 2026-11-zoonk-2
  README.md                        what it announces, what to check before posting, the Zoonk commit the media was rendered from
  posts-en.md  posts-pt.md         every post per account and platform, its media under it; then what was posted, when, and how it did
  en/  pt/                         final images and clips: <scene>-<16x9|4x5>-<light|black>.png, <name>-<16x9|4x5|9x16>[-black].mp4
  source/                          the scenes file and any learner data the set needs to be drawn again
```

A set made only from committed pieces and learners needs just its `scenes.ts` in `source/`; add the learner and view changes too when they aren't in the Zoonk repository yet.

## Never

- Engagement bait: "comment X and I'll send you", polls asking for a reaction, "you won't believe", countdowns, giveaways.
- Criticism of other tools or apps, by name or by hint.
- A personal fact, quote or feeling the owner hasn't said, or a number the app doesn't show.
- An example goal most people won't recognize, such as a niche exam.
- Words on top of an image, a colored ground, a light card on black, or a cropped screen that cuts through what it shows.
- A real learner's data, name or goal; sample learners only.
- A block of hashtags; a link that isn't zoonk.com or the repository.
