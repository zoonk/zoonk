---
name: zoonk-bug-report
description: File a Zoonk bug report on GitHub for anyone, technical or not, in any language. Ask in their words for what's missing, write the issue in English and keep private details out. Use when someone asks you to report a bug or a problem in Zoonk.
license: MIT
metadata:
  author: zoonk
  version: "1.1.0"
---

# Reporting a Zoonk bug

Someone tells you something in Zoonk went wrong, often in everyday words and maybe not in English. Understand what they saw, fill the gaps with them, and file one issue in English that a maintainer can act on without asking again. It goes to [zoonk/zoonk](https://github.com/zoonk/zoonk/issues), which is public, from the person's GitHub account. Its fields come from the [bug report form](../../../.github/ISSUE_TEMPLATE/bug_report.yml).

## Where it belongs

- A security problem, such as seeing someone else's data: don't post it. Send the person to [private reporting](https://github.com/zoonk/zoonk/security/advisories/new).
- A problem with their own account or a payment: Zoonk's [Help page](https://www.zoonk.com/support), where the team answers by email.
- No GitHub account: "Report a problem" in the menu of the screen where it happened, or the Help page. Offer to write the message for them.
- A request for something new or different rather than something broken: an idea, following [zoonk-feature-request](../zoonk-feature-request/SKILL.md). If you're not sure, file it as a bug.

## Talk with them

Use their language and plain words. Skip jargon like "repro", "crash", "cache" or "UI", and never ask them to open developer tools. Thank them; they're helping.

Find out what they actually saw. Common reports and what to ask:

- "It broke" or "it doesn't work": did they see an error message, a blank or frozen screen, the app closing by itself, or something wrong on the screen?
- "It's wrong" about a lesson or practice: the exact question, their answer and what Zoonk said, word for word.
- "I lost my progress": what's missing, where they expected it, and what changed before, such as another device, signing out or a new day.
- "It's slow": which screen, about how long, and whether it's every time.
- "On my phone": the app, or a browser like Chrome or Safari? Ask how they opened Zoonk.

Before filing you need what went wrong, concretely; where (the screen, and the website or the app on which device); and what they did just before. Ask for whichever is missing. Then ask only for the form's other fields that help with this bug. Ask two or three questions at a time, offer examples or choices, and accept "I don't know". Work out the date from your own clock when "just now" or "yesterday" allows it; if you can't see their time zone, ask for their city. Don't hold a report back for nice-to-haves.

If they describe several problems, file one issue for each. If you're passing on someone else's report, such as a support message, ask the person you're talking with for what's missing, and leave the reporter's name and contact details out.

If you can see the code or the running app, you may check the bug there and say what you saw. Don't guess the cause or the fix.

## Check for an existing issue

Search in English with a few words from the problem: `gh issue list --repo zoonk/zoonk --state all --search "<words>"`. If an open issue already describes it, show it to the person instead of filing another. With their OK, add a 👍 (`gh api repos/zoonk/zoonk/issues/<number>/reactions -f content=+1`), and comment only with what's new, like another device or clearer steps, following the rest of this guide. If only a closed one matches, file a new issue and mention it.

## Write it in English

Write the title and every field in plain English, whatever language the person used.

- Translate the meaning, not word for word. Keep every fact; drop greetings and venting.
- Keep text that is itself evidence exactly as it appeared, in its language, with an English translation after it: messages, button labels, lesson content and the person's answers. For example: Zoonk showed "Algo deu errado" ("Something went wrong").
- Name screens the way the English app does when you know it; otherwise quote the name they saw.
- Make the title the symptom as a learner sees it, in under about 80 characters: "Correct answer marked wrong in a Spanish listening exercise", not "Bug in practice".

Open the body with the [disclosure](../zoonk-post-on-behalf/SKILL.md#the-disclosure), adding ", translated from <language>" when they didn't write in English:

```markdown
> [!NOTE]
> 🤖 **<model> opening this issue on behalf of <first name>, translated from <language>**
```

Then add the form's fields in its order, each as a `### <label>` heading with the answer below it, or `_No response_` when there's none. That's how GitHub writes a form submission, so every report reads the same however it was filed.

## Keep private things out

The issue is public and can stay in search results after it's deleted. Leave out emails, phone numbers, full names, passwords, sign-in codes and links, payment details, and personal details from a learning goal (health, immigration, work, family) that the bug doesn't need. Look at every screenshot before it goes up; if it shows any of these, ask the person to crop or cover it, or leave it out.

## Confirm, then file

Show the person what you'll file: the English draft if they read English, otherwise a short summary in their language. File only after they say yes. The `gh` commands are examples; a GitHub connector, the API or a browser works the same way.

If you can create issues from their account (`gh auth status`), write the body in a temporary folder, with any screenshots beside it, and run:

```sh
gh issue create --repo zoonk/zoonk --title "<title>" --body-file <folder>/report.md
```

If the account can write to zoonk/zoonk (`gh api repos/zoonk/zoonk --jq .permissions.push` prints `true`), add `--type Bug`, a `--label` for each of its [labels](../zoonk-github-issues/SKILL.md#labels), and `--attach <folder>/screen.png` for each screenshot, shown under the screenshots heading as `![What the screen shows](./screen.png)`, then set its [priority](../zoonk-github-issues/SKILL.md#priority). Other accounts can't set these, so leave them out. If gh fails, look for the issue (`gh issue list --repo zoonk/zoonk --author @me --limit 3`) before running it again; it may already exist.

Otherwise, or when they have screenshots the account can't attach, give them a link to the filled-in form, with each value URL-encoded and the disclosure at the start of `what-happened`:

```text
https://github.com/zoonk/zoonk/issues/new?template=bug_report.yml&title=<title>&what-happened=<text>&expected=<text>&steps=<text>&device=<text>&language=<text>&when=<text>
```

Tell them, in their language, to sign in to GitHub, pick the right option under "Where were you using Zoonk?" (name it for them), add their screenshots and press Create. A very long link fails, so keep the text tight.

## After filing

Open the issue to check it rendered, then give the person the link. Tell them, in their language, that the team may reply there in English, that GitHub will let them know, and that you can translate replies and help them answer.
