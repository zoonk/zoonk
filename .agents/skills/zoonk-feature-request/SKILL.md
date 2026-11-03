---
name: zoonk-feature-request
description: Post a Zoonk idea or feature request to GitHub Discussions for anyone, technical or not, in any language. Find the need behind the request, write it in English and keep private details out. Use when someone asks you to request, suggest or propose a feature, an idea or a change to Zoonk.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Requesting a Zoonk feature

Someone wants Zoonk to do something it doesn't, often in everyday words and maybe not in English. Understand what they need, fill the gaps with them, and post one idea in English that the team can weigh without asking again. Ideas go to the [Ideas category in Discussions](https://github.com/zoonk/zoonk/discussions/categories/ideas), not to issues: there others can upvote and add to them, and the team opens issues for what it decides to build. Discussions are public, and you post from the person's GitHub account. The fields come from the [ideas form](../../../.github/DISCUSSION_TEMPLATE/ideas.yml).

## Where it belongs

- Something broken, or working differently than it should: a bug, following [zoonk-bug-report](../zoonk-bug-report/SKILL.md). If you're not sure, treat it as a bug.
- A security problem: don't post it. Send the person to [private reporting](https://github.com/zoonk/zoonk/security/advisories/new).
- A problem with their own account or a payment: Zoonk's [Help page](https://www.zoonk.com/support).
- No GitHub account: "Send feedback" in Zoonk's sidebar or search, or the Help page. Offer to write the message for them.

## Talk with them

Use their language and plain words, and skip jargon. Thank them; ideas from learners shape Zoonk.

People often ask for a solution, like "add a dark mode" or "let me skip a lesson". Find the need behind it: what they were doing, what got in the way, and what they do now instead. The team may meet the need another way, so the need matters more than the exact feature. Keep their idea too; don't talk them out of it.

Common requests and what to ask:

- "Add X" or "Zoonk should have X": when would they use it, and what happened the last time they wanted it?
- "Make it easier" or "make it faster": which screen, what they do now step by step, and which step bothers them.
- "Like app Y does": what exactly they like about it, and what it does for them.
- A new language, subject or kind of lesson: what they want to learn and what it's for, like a trip, an exam or work.

Before posting, you need three things, concretely: what they're trying to do, what gets in the way, and their idea. Ask for whichever is missing, then what they do now instead. Ask two or three questions at a time, offer examples, and accept "I don't know". Don't hold an idea back for nice-to-haves.

If they have several ideas, post one discussion for each. If you're passing on someone else's idea, such as a support message, leave that person's name and contact details out.

If you can see the code or the running app, check whether Zoonk already does it; if it does, show them how instead of posting. Don't design the feature or guess how hard it is to build.

## Check for an existing idea

Search in English with a few words from the need, in discussions and in issues. The `gh discussion` commands need GitHub CLI 2.94 or later; with an older one, use the GraphQL API the same way.

```sh
gh discussion list --repo zoonk/zoonk --state all --search "<words>"
gh issue list --repo zoonk/zoonk --state all --search "<words>"
```

- An open discussion asks for the same thing: show it to the person instead of posting another. With their OK, upvote it, and comment only with what's new, like a different situation, following the rest of this guide:

  ```sh
  gh api graphql -f query='mutation($id: ID!) { addUpvote(input: {subjectId: $id}) { subject { upvoteCount } } }' -f id="$(gh discussion view <number> --repo zoonk/zoonk --json id --jq .id)"
  gh discussion comment <number> --repo zoonk/zoonk --body-file <folder>/comment.md
  ```

- An open issue covers it: the team is already tracking it. Show it to them, and with their OK add a 👍 (`gh api repos/zoonk/zoonk/issues/<number>/reactions -f content=+1`). Comment only with what's new.
- Only closed ones match: read why. If it shipped, show them where to find it. If it was closed as a duplicate, check the one it points to. If the team decided against it, tell them why, and post a new idea only when their need is different, linking the old one.

## Write it in English

Write the title and every field in plain English, whatever language the person used.

- Translate the meaning, not word for word. Keep every fact; drop greetings and venting.
- Keep anything they quote from Zoonk exactly as it appeared, in its language, with an English translation after it. For example: the "Revisar" ("Review") button.
- Name screens the way the English app does when you know it; otherwise quote the name they saw.
- Make the title the need or the idea as a learner would say it, in under about 80 characters: "Review the words I got wrong before each new lesson", not "Feature request" or "Suggestion".

Open the body with the [disclosure](../zoonk-post-on-behalf/SKILL.md#the-disclosure), adding ", translated from <language>" when they didn't write in English:

```markdown
> [!NOTE]
> 🤖 **<model> starting this discussion on behalf of <first name>, translated from <language>**
```

Then add the form's fields in its order, each as a `### <label>` heading with the answer below it, or `_No response_` when there's none. That's how GitHub writes a form submission, so every idea reads the same however it was posted.

## Keep private things out

The discussion is public and can stay in search results after it's deleted. Leave out emails, phone numbers, full names, passwords, sign-in codes and links, payment details, and personal details from a learning goal (health, immigration, work, family) that the idea doesn't need: "an exam for my job", not the employer or the exam date.

## Confirm, then post

Show the person what you'll post: the English draft if they read English, otherwise a short summary in their language. Post only after they say yes. The `gh` commands are examples; the API or a browser works the same way. If your tools can't start a discussion, use one of the ways below; never open an issue instead.

If GitHub CLI 2.94 or later is signed in to their account (`gh auth status`), write the body in a temporary folder and run:

```sh
gh discussion create --repo zoonk/zoonk --category ideas --title "<title>" --body-file <folder>/idea.md
```

With an older gh, or another GraphQL client, the API does the same; `R_kgDONx8fQQ` is zoonk/zoonk and `DIC_kwDONx8fQc4Cmenk` is its Ideas category:

```sh
gh api graphql -f query='mutation($title: String!, $body: String!) { createDiscussion(input: {repositoryId: "R_kgDONx8fQQ", categoryId: "DIC_kwDONx8fQc4Cmenk", title: $title, body: $body}) { discussion { url } } }' -f title="<title>" -F body=@<folder>/idea.md
```

If it fails, look at the newest ideas (`gh discussion list --repo zoonk/zoonk --category ideas --limit 5`) before running it again; it may already exist. Leave labels to maintainers.

Otherwise, give them a link to the [ideas form](https://github.com/zoonk/zoonk/discussions/new?category=ideas), the title, and each field's text under the field's name, with the disclosure at the start of the first field. Tell them, in their language, to sign in to GitHub, paste the title and each answer into the field with the same name, and press Start discussion.

A sketch or screenshot goes in on GitHub: they drag it into a field of the form, or into the discussion by editing it after it's posted. Ask them to cover anything private first.

## After posting

Open the discussion to check it rendered, then give the person the link. Tell them, in their language, that others can upvote it, that the team may reply there in English and GitHub will let them know, and that you can translate replies and help them answer.
