# @zoonk/testing

Prisma fixtures and shared browser diagnostics for Zoonk tests. Test boundaries and isolation rules live in the [testing skill](../../.agents/skills/zoonk-testing/SKILL.md).

Add as a dev dependency in your app:

```json
{ "devDependencies": { "@zoonk/testing": "workspace:*" } }
```

Import fixtures in your tests:

```ts
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
```
