## Tests

- Use the same name as the controller, but with `_test` suffix (e.g., `test/zoonk_web/controllers/user_session_controller_test.exs`) and the module name would be `ZoonkWeb.UserSessionControllerTest`.
- Use `use ZoonkWeb.ConnCase, async: true` for `ZoonkWeb` tests and `use Zoonk.DataCase, async: true` for `Zoonk` tests.
- When creating a new schema or context, create a fixtures file for it at `test/support/fixtures`.
- Add fixtures individually to each test instead of adding them to the `setup` block.
- Use the `PhoenixTest` library for testing.
- `Phoenix.ConnTest.get_flash/2` is deprecated. Use `Phoenix.Flash.get/2` instead.
- When testing private functions, don't make them public for testing purposes only. Instead, test public functions that call them.
