---
name: zoonk-blog-post
description: Write a Zoonk blog post, such as a release or launch post, that makes readers want to try what it shows, in Zoonk's voice and with real screenshots, clips and a cover from the app. Use when asked to write, rewrite or review a post for the blog (apps/blog).
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Blog posts

A reader should finish a Zoonk post understanding what something does for them and thinking "this is really cool, I want to use it". A release post shows what each feature is and how it solves the reader's problem. Everything else stays out.

[The 2.0 launch post](<../../../apps/blog/src/app/(post)/2026/zoonk-2/page.mdx>) is the model. Read it and look at its pictures before you write.

## 1. Pick what to show

- A release post covers the three or four changes that will make the most readers want to try Zoonk, taken from the release notes' Highlights and Features. Each one gets its own section. The rest goes in a short list, or in a link to the release notes on GitHub.
- Leave out fixes, polish and speed work unless a reader would notice them right away. A post isn't a changelog.
- A feature goes in only if a reader can use it on the web today. Leave the Apple and Android apps out until they're in their stores ([the store check](../zoonk-release/SKILL.md#2-read-what-changed)).

## 2. Write it

Write as the founder, the way the 2.0 post does: "I" for his own view, "we" for Zoonk and "you" for the reader.

- **Start each section from the reader's life:** the exam, the move abroad, the job interview, the moment a lesson stops making sense. Then say what the feature does about it, with one concrete example a reader can picture, such as "If you keep writing 'I live here since 2020,' it shows you the rule behind it."
- **Keep it light:** short paragraphs, everyday words and a picture every few paragraphs. A section takes a few short paragraphs. It isn't a list of everything the feature does. A reader should get through the whole post in about five minutes.
- **Say only what's true today.** Check every claim, label and number against the code and the English catalogs, the way the release notes do. Quote each label exactly as the app shows it, and say plainly what needs Plus.
- **Opinions are fine when they're real**, such as "I don't like streaks."
- **Run the self-check** in [copywriting's AI tells](../copywriting/references/ai-tells.md) and rewrite whatever it flags.

Leave out how we built it:

- Models, prompts, evals, quality scores, internal names, PR numbers and the bugs we fixed along the way.
- Stories from PR descriptions, testers or previews, such as "a beginner told us…". The reader wants to know what the feature does for them, not where the idea came from.

## 3. Show it

Every feature section shows the real product. Pictures are what make a reader want it, so spend the effort here.

- **Screens:** one `Screens` row per section, with one to three phone screenshots. Each gets a short caption that says what the reader gets, such as "Help on any screen". Show the feature's best moment with realistic data, never an empty state, a loading screen or placeholder text.
- **Motion:** when a still can't show the point, such as a conversation that follows along, use a short muted clip that loops.
- **Cover:** three phones showing the post's main features on a plain ground, at 1600×900, like the 2.0 cover.
- **Social card:** an `opengraph-image.png` (1200×630) with an `opengraph-image.alt.txt` next to the page.
- **Light and dark:** every screenshot, clip and cover comes in both versions (`<name>.webp` and `<name>-dark.webp`).
- **Alt text:** describe what each picture shows, including any text the reader would read on it.

Capture from the running app (`pnpm start`), using sample learners only (`pnpm dev:persona`, see the [development guide](../../guides/development.md#persona-passes)), never a real learner's data. `pnpm pr:capture --steps <file> --schemes light,dark --viewports phone` shoots the 390×844 phone screen. Save each shot as a WebP at 780×1688 in `apps/blog/public/blog/<year>/<slug>/`. When a post needs many screens, delegate the capture.

## 4. Put it together

- The post goes in `apps/blog/src/app/(post)/<year>/<slug>/page.mdx`, with `metadata` (`title` and `description`) and `PostMeta`. Add it to the top of `apps/blog/src/app/posts.json` with the same date.
- A release post's title is "Zoonk <version>: <what the reader gets>". The intro is two or three sentences on what's new for the reader.
- End with the `Cta` block, as the 2.0 post does.
- The components are in `apps/blog/src/components`: `Cover`, `Screens` and `Screen`, `CardLinks` and `Cta`.
- Open the PR with [zoonk-pull-request](../zoonk-pull-request/SKILL.md).
