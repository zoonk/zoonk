# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.25.5",
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
      "NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]
    }
  ]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Configure tailwind (the version is required)
config :tailwind,
  version: "4.1.10",
  zoonk: [
    args: ~w(
      --input=assets/css/app.css
      --output=priv/static/assets/app.css
    ),
    cd: Path.expand("..", __DIR__)
  ]

# Oban configuration
config :zoonk, Oban,
  engine: Oban.Engines.Basic,
  queues: [default: 10],
  repo: Zoonk.Repo,
  shutdown_grace_period: to_timeout(minute: 1),
  plugins: [
    # Delete jobs after 7 days
    {Oban.Plugins.Pruner, max_age: 60 * 60 * 24 * 7},
    # Automatically move failed jobs back to available so they can run again
    {Oban.Plugins.Lifeline, rescue_after: to_timeout(minute: 30)}
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

# Supported OAuth providers
config :zoonk, :oauth_providers, [:apple, :github, :google]

# UserToken config
config :zoonk, :user_token,
  rand_size: 32,

  # How old the session token should be before a new one is issued. When a request is made
  # with a session token older than this value, then a new session token will be created
  # and the session and remember-me cookies (if set) will be updated with the new token.
  # Lowering this value will result in more tokens being created by active users. Increasing
  # it will result in less time before a session token expires for a user to get issued a new
  # token. This can be set to a value greater than `max_age_days.session` to disable
  # the reissuing of tokens completely.
  renew_token_days: 7,
  max_age_days: %{
    session: 365,
    change_email: 7
  },
  max_age_minutes: %{
    otp: 15,
    sudo_mode: -10
  }

# Configures Ecto
config :zoonk,
  ecto_repos: [Zoonk.Repo],
  generators: [timestamp_type: :utc_datetime_usec]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
