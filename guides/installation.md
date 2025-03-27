# Installation

You can run this project locally or in a Docker container.

## Using Docker

- `cd docker`
- `docker-compose build`
- `docker-compose up`

## Using Elixir locally

### Requirements

- You need `Elixir 1.18` or later and `Erlang 27` or later. Run `elixir -v` to find your current version for [Elixir](https://elixir-lang.org/install.html)
  and [Erlang](https://elixir-lang.org/install.html#installing-erlang). You can also use [mise](https://mise.jdx.dev) or [asdf](https://asdf-vm.com/) to manage your Elixir and Erlang versions.
- Install [Hex](https://hex.pm/): `mix local.hex`.
- Install `Phoenix`: `mix archive.install hex phx_new`.
- [PostgreSQL 17+](https://www.postgresql.org/).
- (Linux users only): [inotify-tools](https://github.com/inotify-tools/inotify-tools/wiki).

### Getting started

- Install dependencies and set up both the database and assets: `mix setup`.

### Local development

- Start a local server: `mix phx.server`.
- Run tests: `mix test` or `mix test.watch` for live reloading.
- Update translation files: `mix locale`.

> ### Tip {: .tip}
>
> Add a `.github/copilot/llm_docs/phoenix_test.md` file to your project to improve testing generation.
> You can use [hex2txt](https://hex2txt.fly.dev/phoenix_test/llms.txt) to generate a `txt` file for it.
> Copy the content of the `txt` file and paste it into the `phoenix_test.md` file.

### UI Preview

- You can have a preview of every UI component in the `/lib/zoonk_dev/ui_preview` folder. To do so, run `mix phx.server` and open your browser at http://localhost:4000/ui.
