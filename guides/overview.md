# Overview

> #### 🚧 Under construction 🚧 {: .warning}
>
> This project is a work in progress, and we're building it in public. DO NOT USE IT.
> We'll update this notice once the features described here are available for production use.

Zoonk is a white-label platform for building interactive courses. You can create content manually or use LLMs to generate it from a topic or your own documents. We also offer a REST API for seamless integration with other systems.

## Our tech stack

- **Programming language**: [Elixir](https://elixir-lang.org/)
- **Framework**: [Phoenix](https://www.phoenixframework.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/), [Ecto](https://hexdocs.pm/ecto)
- **Frontend**: [LiveView](https://hexdocs.pm/phoenix_live_view), [Tailwind CSS](https://tailwindcss.com/)
- **AI**: [OpenAI](https://openai.com/), [Black Forest Labs](https://blackforestlabs.ai), [Together AI](https://together.ai/)
- **Deployment**: [Fly.io](https://fly.io/)
- **File storage**: [Tigris](https://tigrisdata.com/)
- **Emails**: [Resend](https://resend.com/), [Swoosh](https://hexdocs.pm/swoosh)
- **Payments**: [Stripe](https://stripe.com/)
- **Background jobs**: [Oban](https://hexdocs.pm/oban)
- **Translations**: [Gettext](https://hexdocs.pm/gettext)
- **Monitoring**: [AppSignal](https://www.appsignal.com/)
- **Testing**: [ExUnit](https://hexdocs.pm/ex_unit)
- **Continuous integration**: [GitHub Actions](https://docs.github.com/en/actions)
- **Documentation**: [ex_doc](https://hexdocs.pm/ex_doc)
- **Code quality**: [Credo](https://hexdocs.pm/credo), [mix format](https://hexdocs.pm/mix/Mix.Tasks.Format.html), [Prettier](https://prettier.io/), [styler](https://hexdocs.pm/styler)

## Directory structure

- **`.github`** – GitHub-related files, including CI workflows and Copilot instructions.
- **`assets`** – CSS and JavaScript files/libraries.
- **`config`** – Configuration files for `dev`, `test`, `runtime`, and `prod` environments.
- **`credo`** – Custom Credo checks.
- **`lib`** – Core application code, covering both business logic and the web interface.
  - **`zoonk`** – Business logic and domain models.
    - **`_queries`** – Organized queries for each model, making business logic explicit and composable.
    - **`_schemas`** – Ecto schemas for each model.
    - **Contexts** – Encapsulated behaviors acting as event-driven commands.
      - Example:
        - `Zoonk.Auth` – Authentication context.
        - `Zoonk.Auth.TokenBuilder` – Sub-context for auth token generation.
        - `Zoonk.Auth.UserNotifier` – Sub-context for sending auth-related emails.
  - **`zoonk_web`** – Web interface, including API and frontend.
    - **`components`** – LiveView (`Phoenix.LiveComponent`) and function components (`Phoenix.Component`).
    - **`controllers`** – API and web controllers.
    - **`layouts`** – Web interface layouts.
    - **`live`** – Pages using `Phoenix.LiveView`.
    - **`router.ex`** – Web interface router.
- **`priv`** – Static files, migrations, seeds, and translations.
- **`test`** – Application tests.
