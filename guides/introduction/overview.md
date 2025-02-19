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

- `.github`: Continuous integration workflows, Copilot instructions, and anything else related to GitHub.
- `assets`: CSS and JavaScript files/libraries.
- `config`: Configuration files for `dev`, `test`, `runtime`, and `prod` environments.
- `lib`: The main application code, including both the web interface and business logic.
  - `zoonk`: Business logic and domain models.
    - `_checks`: Custom checks for Credo.
    - `_queries`: Queries for each model, organized here for composability and making explicit what they do/what business logic they implement/what our intent is.
    - `_schema`: Ecto schemas for each model.
    - Phoenix contexts for our application. Each context is a module that encapsulates a behavior. Think of them as events that trigger commands. For example, `Zoonk.Auth` is the context for authentication; `Zoonk.Auth.TokenBuilder` is a sub-context for building auth tokens; while `Zoonk.Auth.UserNotifier` is a sub-context for sending auth-related emails to users.
  - `zoonk_web`: Web interface, including controllers, views, and templates. It includes both the API and the frontend.
    - `components`: LiveView (see `Phoenix.LiveComponent`) and function components (see `Phoenix.Component`) to be used in the UI.
    - `controllers`: Controllers for the API and the web interface.
    - `layouts`: Layouts for the web interface.
    - `live`: Frontend pages using `Phoenix.LiveView`.
    - `router.ex`: The router for the web interface.
- `priv`: Static files, migrations, seeds, and translations.
- `test`: Tests for the application.
