## Controllers

- Controllers should be placed in the `lib/zoonk_web/controllers` directory.
- Add a `@moduledoc` to each controller.
- Add a `@doc` to each action in the controller, explaining its purpose.
- Controller modules are prefixed with their context name (e.g., `ZoonkWeb.Accounts.OAuthController`).
- Use the module name as the file name (e.g., `lib/zoonk_web/controllers/accounts/oauth_controller.ex`).
- Use `use ZoonkWeb, :controller` in each controller module.
- Add tests to the `test/zoonk_web/controllers` directory.
