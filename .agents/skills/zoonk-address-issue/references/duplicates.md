# Duplicates

What to do when [finding related issues](../SKILL.md#2-find-related-issues) turns up the same problem.

It's a duplicate when an open issue describes the same problem, even in other words or from another screen. Keep the one with the discussion or a linked PR, otherwise the older one, and close the other as its duplicate. GitHub records the relationship and shows it on both:

```sh
gh issue close <duplicate> --repo zoonk/zoonk --duplicate-of <original>
```

Check `duplicateOf` on the closed one with the query in [read it](../SKILL.md#1-read-it). If it had something the original lacks, such as another device or clearer steps, add that to the original as a comment. Then carry on with the original.

When only a closed issue matches: if it was fixed and the problem is back, this is a regression, so go on here and mention the old issue. If it was closed as not planned, read why; close this one as its duplicate unless it brings something new.
