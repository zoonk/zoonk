---
name: zoonk-post-on-behalf
description: Publish as the user's agent, such as GitHub issues, comments, discussions or pull requests in other repositories, with a disclosure naming the model. Use before anything an agent writes goes out under the user's account.
license: MIT
metadata:
  author: zoonk
  version: "1.1.0"
---

# Posting on behalf of the user

Anything an agent publishes from the user's account says so up front. Readers know who wrote it, and the user stays accountable for it.

## Before posting

- Get the user's go-ahead for this post. A public post can be cached or indexed even after it's deleted, and a go-ahead for one post doesn't cover the next. A standing approval in the user's own instructions, such as one for upstream bug reports through [zoonk-upstream-issue](../zoonk-upstream-issue/SKILL.md), counts.
- Check that the active account (`gh auth status`) is the one the user wants to post from.
- Keep private things out: product, company and customer names unless the user wants them, internal links and paths, private repositories, secrets, and logs with user data.
- Claim only what you verified. Say "once in about 200 builds", not "often".

## The disclosure

Start the post with a GitHub note:

```markdown
> [!NOTE]
> 🤖 **<model> opening this issue on behalf of <first name>**
```

- Replace both placeholders with real values. The post never shows `<model>`, `<first name>` or the words "the user".
- `<model>`: the exact model writing it, as your runtime reports it ("Claude Opus 5.5"), and every agent or model that wrote part of it ("GPT-6.1-Sol and Claude Opus 5.5"). Never guess a model name.
- `<first name>`: the first name on the posting account's GitHub profile (`gh api user --jq .name`). If the profile has no name, ask the user for it.
- Name what the post is: "opening this issue", "responding", "opening this pull request".
- Where the note doesn't render, make the same sentence the first line.

## The voice

Write the rest as the user would: first person ("I", "we"), direct, short sentences, the point first. No apologies for being an AI, and no filler.

## After posting

- Open the post to check it rendered (`gh issue view`).
- Give the user the link. Don't answer follow-ups without asking; drafting a reply for the user is fine.
