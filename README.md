# Zoonk

## Requirements

- Run `elixir -v` to find your current version for [Elixir](https://elixir-lang.org/install.html)
  and [Erlang](https://elixir-lang.org/install.html#installing-erlang).
  You need `Elixir 1.14` or later and `Erlang 25` or later.
- Install [Hex](https://hex.pm/): `mix local.hex`.
- Install [Phoenix](https://www.phoenixframework.org/): `mix archive.install hex phx_new`.
- [PostgreSQL 15+](https://www.postgresql.org/).
- (Linux users only): [inotify-tools](https://github.com/inotify-tools/inotify-tools/wiki).

## Getting started

- Install dependencies and set up the database: `mix setup`.

## Local development

- Start a local server: `mix phx.server` (it will run on http://localhost:4000 and https://localhost:4001).
  See [SSL in Development](#ssl-in-development) for using the `HTTPS` version on port `4001`.
- Run tests: `mix test`.

## SSL in Development

Phoenix has a [generator](https://hexdocs.pm/phoenix/Mix.Tasks.Phx.Gen.Cert.html)
for creating a self-signed certificate for HTTPS testing: `mix phx.gen.cert`.

However, when using Phoenix's generator you'll still have a `non secure` warning.
To get rid of that warning, you can generate a certificate using
[mkcert](https://github.com/FiloSottile/mkcert).

After you install `mkcert`, follow the steps below:

- Create a `cert` directory under `priv`: `mkdir priv/cert`.
- Generate a new certificate: `mkcert -key-file priv/cert/selfsigned_key.pem -cert-file priv/cert/selfsigned.pem localhost`.
- Restart your local server: `mix phx.server`. You may also need to restart your browser.
