# Database integration tests

Exercise the real capability against the configured test database. Use the workspace's Vitest setup and helpers in `packages/testing/src/fixtures`; inspect neighboring tests for the current authentication/request harness. Do not copy an old app data-layer or caller-selected-user API into new tests.

- Persist fixtures with real Prisma and call the exported business capability. Assert both its result and the relevant database state when writes, constraints, cascades, or transactions are the behavior under test.
- Public authenticated core capabilities derive the acting user through the shared session boundary. Sign in with the real test auth helpers and establish request context through the existing harness; do not bypass authorization with an acting `userId` parameter.
- Cover relevant access distinctions such as anonymous, owner, other user, organization role, or publication state. Test the actual permissions of the capability instead of imposing every role on every function.
- Use unique users and records for mutable state. Create independent fixtures with `Promise.all`; keep dependent records ordered. A shared mutable `beforeAll` fixture can leak state across tests.
- Exercise real uniqueness conflicts, rollback, retry, and request-order behavior where the changed contract depends on them. Mock only an unavoidable external boundary, with the reason documented beside the mock.
- Keep pure normalization and transformation rules in their owning utility modules and test their public behavior directly. Do not add exports solely for tests.

Use `mise x -- pnpm --filter <workspace> test <test-file>` for focused runs. Existing setup/configuration is the source of truth for database selection; do not print credentials or repoint tests at another environment to get them running.
