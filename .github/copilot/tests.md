## Tests

- Always add tests to any functionality you add or modify.
- Use the same name as the controller, but with `_test` suffix (e.g., `test/zoonk_web/controllers/accounts/user_session_controller_test.exs`) and the module name would be `ZoonkWeb.Accounts.UserSessionControllerTest`.
- Use `use ZoonkWeb.ConnCase, async: true` for `ZoonkWeb` tests and `use Zoonk.DataCase, async: true` for `Zoonk` tests.
- When creating a new schema or context, create a fixtures file for it at `test/support/fixtures`.
- Add fixtures individually to each test instead of adding them to the `setup` block.
- After writing tests, always run `mix ci` to test our code to make sure everything is working as expected.
