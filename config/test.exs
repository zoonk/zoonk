import Config

# Print only warnings and errors during test
config :logger, level: :warning

# Clear the console before each test run
config :mix_test_watch,
  clear: true,
  tasks: ["test", "ci"]

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view, enable_expensive_runtime_checks: true

# Endpoint for routing requests when using the Phoenix Test library
config :phoenix_test, :endpoint, ZoonkWeb.Endpoint

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Jobs execute immediately within the calling process and without touching the database
config :zoonk, Oban, testing: :inline

# In test we don't send emails
config :zoonk, Zoonk.Mailer, adapter: Swoosh.Adapters.Test

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :zoonk, Zoonk.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "zoonk_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :zoonk, ZoonkWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "oR5QwNJN5R6aqfWx9lZhHUZ58uqJFBNdGN89Dk5fAZz1LX+19tGo9tUULRYzv4el",
  server: false

config :zoonk, :ai,
  openai: [
    plug: {Req.Test, :openai_client}
  ],
  togetherai: [
    plug: {Req.Test, :togetherai_client}
  ],
  gemini: [
    plug: {Req.Test, :gemini_client}
  ],
  openrouter: [
    plug: {Req.Test, :openrouter_client}
  ]

config :zoonk, :ai_models,
  eval: "o4-mini",
  suggest_courses: "gpt-4.1-nano"

# Configures the URL used for external orgs
config :zoonk, :external_org_url, "http://localhost:4000"

# Disable Stripe calls for testing
config :zoonk, :stripe,
  webhook_secret: "whsec_test_secret_key_for_webhook_verification",
  opts: [
    plug: {Req.Test, :stripe_client}
  ]

# Enable Dev routes for testing
config :zoonk, dev_routes: true
