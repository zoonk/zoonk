import Config

# For production, don't forget to configure the url host
# to something meaningful, Phoenix uses this information
# when generating URLs.
config :hello, HelloWeb.Endpoint,
  force_ssl: [hsts: true],
  http: [port: {:system, "PORT"}],
  url: [host: "app.zoonk.org"],
  cache_static_manifest: "priv/static/cache_manifest.json",
  https: [
    port: 443,
    cipher_suite: :strong,
    otp_app: :zoonk,
    keyfile: System.get_env("ZOONK_SSL_KEY_PATH"),
    certfile: System.get_env("ZOONK_SSL_CERT_PATH"),
    # OPTIONAL Key for intermediate certificates:
    cacertfile: System.get_env("INTERMEDIATE_CERTFILE_PATH")
  ]

# Note we also include the path to a cache manifest
# containing the digested version of static files. This
# manifest is generated by the `mix phx.digest` task,
# which you should run after static files are built and
# before starting your production server.
config :zoonk, ZoonkWeb.Endpoint, cache_static_manifest: "priv/static/cache_manifest.json"

# Configures Swoosh API Client
config :swoosh, api_client: Swoosh.ApiClient.Finch, finch_name: Zoonk.Finch

# Do not print debug messages in production
config :logger, level: :info

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
