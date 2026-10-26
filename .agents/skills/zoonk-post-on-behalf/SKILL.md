---
name: zoonk-post-on-behalf
description: Publish as the owner's agent, such as GitHub issues, comments, discussions or pull requests in other repositories, with a disclosure naming the model. Use before anything an agent writes goes out under the owner's account.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Posting on behalf of the owner

Anything an agent publishes from the owner's account says so up front, as [Theo does](https://github.com/anthropics/claude-code/issues/97074#issuecomment-6392296206) on posts his agents write. Readers know who wrote it, and the owner stays accountable for it.

## Before posting

- Get the owner's go-ahead for this post. A public post can be cached or indexed even after it's deleted, and a go-ahead for one post doesn't cover the next.
- Check that the active account (`gh auth status`) is the one the owner wants to post from.
- Keep private things out: product, company and customer names unless the owner wants them, internal links and paths, private repositories, secrets, and logs with user data.
- Claim only what you verified. Say "once in about 200 builds", not "often".

## The disclosure

Start the post with a GitHub note:

```markdown
> [!NOTE]
> 🤖 **Claude Opus 5.5 opening this issue on behalf of Will**
```

- Name the exact model writing it, and every agent or model that wrote part of it ("Muse Wonder Full and Claude Opus 5.5").
- Name what the post is: "opening this issue", "responding", "opening this pull request".
- Use the owner's first name, as their GitHub profile has it (`gh api user --jq .name`).
- Where the note doesn't render, make the same sentence the first line.

## The voice

Write the rest as the owner would: first person ("I", "we"), direct, short sentences, the point first. No apologies for being an AI, and no filler.

## After posting

- Open the post to check it rendered (`gh issue view`).
- Give the owner the link. Don't answer follow-ups without asking; drafting a reply for the owner is fine.
