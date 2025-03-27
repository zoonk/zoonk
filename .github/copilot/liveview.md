## LiveView pages

- LiveView pages should be placed in the `lib/zoonk_web/live` directory.
- Group similar pages together. For example, the `lib/zoonk_web/live/user` directory contains all user-related pages.
- Use `@moduledoc false` for LiveView pages.
- Keep the html and business logic in the `.ex` file, using the `render` callback from `Phoenix.LiveView`.
- Add the `render` callback at the top of the module, before other callbacks like `mount`, `handle_params`, etc.
- Use `use ZoonkWeb, :live_view`.
- Add tests to the `test/zoonk_web/live` directory.
