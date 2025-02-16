import Config

# Print only warnings and errors during test
config :logger, level: :warning

# Clear the console before each test run
config :mix_test_watch, clear: true

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view, enable_expensive_runtime_checks: true

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

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
