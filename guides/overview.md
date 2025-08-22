# Overview

> #### 🚧 Under construction 🚧 {: .warning}
>
> This project is a work in progress, and we're building it in public. DO NOT USE IT.
> We'll update this notice once the features described here are available for production use.

Zoonk is an open-source app for learning anything using AI. Check out our [long-term vision](https://github.com/orgs/zoonk/discussions/176) to see how we plan to evolve the product.

## Our tech stack

- **Programming language**: [Elixir](https://elixir-lang.org/)
- **Framework**: [Phoenix](https://www.phoenixframework.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/), [Ecto](https://hexdocs.pm/ecto)
- **Frontend**: [LiveView](https://hexdocs.pm/phoenix_live_view), [Tailwind CSS](https://tailwindcss.com/)
- **AI**: [OpenAI](https://openai.com/), [OpenRouter](https://openrouter.ai/), [Google AI](https://ai.google.dev), [Together AI](https://together.ai/)
- **Deployment**: [Fly.io](https://fly.io/)
- **File storage**: [Tigris](https://tigrisdata.com/)
- **Emails**: [ZeptoMail by Zoho](https://www.zoho.com/zeptomail/), [Swoosh](https://hexdocs.pm/swoosh)
- **Payments**: [Stripe](https://stripe.com/)
- **Background jobs**: [Oban](https://hexdocs.pm/oban)
- **Translations**: [Gettext](https://hexdocs.pm/gettext)
- **Testing**: [ExUnit](https://hexdocs.pm/ex_unit)
- **Continuous integration**: [GitHub Actions](https://docs.github.com/en/actions)
- **Documentation**: [ex_doc](https://hexdocs.pm/ex_doc)
- **Code quality**: [Credo](https://hexdocs.pm/credo), [mix format](https://hexdocs.pm/mix/Mix.Tasks.Format.html), [Prettier](https://prettier.io/), [styler](https://hexdocs.pm/styler)

## Directory structure

- **`.github`** – GitHub-related files, including CI workflows and Copilot instructions.
- **`assets`** – CSS and JavaScript files/libraries.
- **`config`** – Configuration files for `dev`, `test`, `runtime`, and `prod` environments.
- **`lib`** – Core application code, covering both business logic and the web interface.
  - **`zoonk`** – Business logic, schemas, and contexts.
  - **`zoonk_web`** – Web interface, including API and frontend.
    - **`components`** – LiveView (`Phoenix.LiveComponent`) and function components (`Phoenix.Component`).
    - **`controllers`** – API and web controllers.
    - **`live`** – Pages using `Phoenix.LiveView`.
    - **`ui_preview`** – UI component previews.

- **`priv`** – Static files, migrations, seeds, AI evals, and translations.
- **`test`** – Application tests.
