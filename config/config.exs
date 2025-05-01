# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.0",
  zoonk: [
    args: ~w(
      js/app.js
      --bundle
      --target=es2022
      --outdir=../priv/static/assets
      --external:/fonts/*
      --external:/images/*
      --external:/error/*
      ),
    cd: Path.expand("../assets", __DIR__),
    env: %{
      "NODE_PATH" => Path.expand("../deps", __DIR__)
    }
  ]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Posthog configuration
config :posthog,
  api_url: "https://ph.zoonk.com",
  # This key is public, so it's okay to get it during compile time
  api_key: System.get_env("POSTHOG_API_KEY")

# Configure tailwind (the version is required)
config :tailwind,
  version: "4.0.14",
  zoonk: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/app.css
    ),
    cd: Path.expand("..", __DIR__)
  ]

# Configure translation
config :zoonk, Zoonk.Gettext, default_locale: "en"

# Configures the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :zoonk, Zoonk.Mailer, adapter: Swoosh.Adapters.Local

# Configures the endpoint
config :zoonk, ZoonkWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: ZoonkWeb.ErrorHTML, json: ZoonkWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Zoonk.PubSub,
  live_view: [signing_salt: "aQIHSki0"]

# Make sure all schemas are migrated when running `mix cloak.migrate.ecto`
config :zoonk,
  cloak_repo: Zoonk.Repo,
  cloak_schemas: [Zoonk.Accounts.User]

# Configures Ecto
config :zoonk,
  ecto_repos: [Zoonk.Repo],
  generators: [timestamp_type: :utc_datetime_usec]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
