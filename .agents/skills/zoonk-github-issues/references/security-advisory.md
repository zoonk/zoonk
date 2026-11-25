# File a security hole as a private advisory

A security hole, such as one learner seeing another's data, never goes in an issue, a comment or a PR body: zoonk/zoonk is public. It still gets tracked: file a draft repository security advisory, which only repository admins and the collaborators added to it can see, and give the user its link. A draft about the same problem may already exist (`gh api "repos/zoonk/zoonk/security-advisories?state=draft" --jq '.[] | "\(.ghsa_id): \(.summary)"'`); update that one instead of filing another.

The advisory says:

- the problem: what an attacker can do, and to whose data or money
- where it's reachable: the entry point and the steps
- its limits: what an attacker needs, and what you tested and didn't
- the recommended fix

Write the request body outside the repository and post it:

```sh
gh api -X POST repos/zoonk/zoonk/security-advisories --input advisory.json
```

The body has `summary`, `description`, `severity` (`critical`, `high`, `medium` or `low`; `moderate` is rejected), `cwe_ids`, and `vulnerabilities: [{ "package": { "ecosystem": "other", "name": "zoonk" }, "vulnerable_version_range": "<range>", "patched_versions": null }]`. The response's `html_url` is the link. The user decides how the fix ships, such as in the advisory's private fork, so don't open a public PR for it on your own.

Filing needs admin or security-manager rights (`gh api repos/zoonk/zoonk --jq .permissions.admin` prints `true`). Without them, give the user the same four points privately, such as in your handoff, and say you couldn't file the advisory.
