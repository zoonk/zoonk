defmodule Zoonk.MixProject do
  use Mix.Project

  def project do
    [
      app: :zoonk,
      version: "0.1.0-dev",
      elixir: "~> 1.18",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      preferred_cli_env: ["test.watch": :test],

      # Docs
      name: "Zoonk",
      source_url: "https://github.com/zoonk/zoonk",
      docs: &docs/0
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {Zoonk.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:assent, "~> 0.3.0"},
      {:bandit, "~> 1.5"},
      {:cloak_ecto, "~> 1.3.0"},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dns_cluster, "~> 0.2.0"},
      {:ecto_sql, "~> 3.10"},
      {:esbuild, "~> 0.9", runtime: Mix.env() == :dev},
      {:ex_doc, "~> 0.37", only: :dev, runtime: false},
      {:floki, ">= 0.30.0", only: :test},
      {:gettext, "~> 0.26"},
      {:jason, "~> 1.2"},
      {:mix_audit, "~> 2.1", only: [:dev, :test], runtime: false},
      {:mix_test_watch, "~> 1.2", only: [:dev, :test], runtime: false},
      {:phoenix_ecto, "~> 4.5"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      {:phoenix_live_reload, "~> 1.2", only: :dev},
      {:phoenix_live_view, "~> 1.0.0"},
      {:phoenix, "~> 1.7.19"},
      {:postgrex, ">= 0.0.0"},
      {:regions_db,
       github: "dr5hn/countries-states-cities-database",
       branch: "master",
       sparse: "psql",
       app: false,
       compile: false,
       depth: 1},
      {:req, "~> 0.5.0"},
      {:sobelow, "~> 0.13", only: [:dev, :test], runtime: false},
      {:styler, "~> 1.4", only: [:dev, :test], runtime: false},
      {:swoosh, "~> 1.5"},
      # Using the main branch instead of tags because of the size. Using the tag had over 1gb. Using a branch has less than 60mb.
      {:tabler_icons,
       github: "tabler/tabler-icons", branch: "main", sparse: "icons", app: false, compile: false, depth: 1},
      {:tailwind, "~> 0.3", runtime: Mix.env() == :dev},
      {:tailwind_formatter, "~> 0.4.2", only: [:dev, :test], runtime: false},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.0"}
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to install project dependencies and perform other setup tasks, run:
  #
  #     $ mix setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      setup: ["deps.get", "ecto.setup", "assets.setup", "assets.build"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
      "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
      "assets.build": ["tailwind zoonk", "esbuild zoonk"],
      "assets.deploy": ["tailwind zoonk --minify", "esbuild zoonk --minify", "phx.digest"],
      locale: ["gettext.extract", "gettext.merge priv/gettext"],
      ci: [
        "compile --all-warnings --warnings-as-errors",
        "format --check-formatted",
        "credo --strict",
        "sobelow --config",
        "deps.unlock --check-unused",
        "deps.audit",
        "xref graph --label compile-connected --fail-above 0 --exclude lib/zoonk/_encrypted/binary.ex"
      ]
    ]
  end

  # Docs
  defp docs do
    [
      main: "overview",
      logo: "priv/static/images/logo.svg",
      extra_section: "GUIDES",
      extras: [
        "guides/overview.md",
        "guides/glossary.md",
        "guides/installation.md",
        "guides/ssl.md",
        "guides/oauth.md",
        "guides/production.md"
      ],
      groups_for_modules: [
        Config: [Zoonk.Configuration],
        Components: [
          ZoonkWeb.Components.Anchor,
          ZoonkWeb.Components.Button,
          ZoonkWeb.Components.DataList,
          ZoonkWeb.Components.Divider,
          ZoonkWeb.Components.Flash,
          ZoonkWeb.Components.Form,
          ZoonkWeb.Components.Icon,
          ZoonkWeb.Components.Input,
          ZoonkWeb.Components.Layout,
          ZoonkWeb.Components.Modal,
          ZoonkWeb.Components.Table,
          ZoonkWeb.Components.Text,
          ZoonkWeb.Components.User,
          ZoonkWeb.Components.Utils
        ],
        Controllers: [
          ZoonkWeb.Controllers.Legal,
          ZoonkWeb.Controllers.OAuth,
          ZoonkWeb.Controllers.UserAuth
        ],
        Plugs: [
          ZoonkWeb.Plugs.Language,
          ZoonkWeb.Plugs.UserAuth
        ],
        Hooks: [
          ZoonkWeb.Hooks.ActivePage,
          ZoonkWeb.Hooks.Language,
          ZoonkWeb.Hooks.UserAuth
        ],
        Helpers: [
          Zoonk.Helpers,
          Zoonk.Helpers.EctoUtils,
          ZoonkWeb.Helpers.UserAuth
        ],
        Contexts: [
          Zoonk.Auth,
          Zoonk.Auth.Providers,
          Zoonk.Auth.TokenBuilder,
          Zoonk.Auth.UserNotifier,
          Zoonk.Auth.UserProfileBuilder
        ],
        Scopes: [Zoonk.Auth.Scope],
        Services: [
          Zoonk.Mailer
        ],
        Schemas: [
          Zoonk.Schemas.City,
          Zoonk.Schemas.Country,
          Zoonk.Schemas.Region,
          Zoonk.Schemas.State,
          Zoonk.Schemas.Subregion,
          Zoonk.Schemas.User,
          Zoonk.Schemas.UserProfile,
          Zoonk.Schemas.UserProvider,
          Zoonk.Schemas.UserToken
        ],
        Queries: [
          Zoonk.Queries.UserToken
        ],
        "Error Handling": [ZoonkWeb.ErrorHTML, ZoonkWeb.ErrorJSON],
        "Credo Checks": [Zoonk.Check.Readability.PipeEctoQueries],
        Core: [
          Zoonk,
          Zoonk.Check,
          Zoonk.Gettext,
          Zoonk.Repo,
          Zoonk.Vault,
          ZoonkWeb,
          ZoonkWeb.Endpoint,
          ZoonkWeb.Layouts,
          ZoonkWeb.Router
        ]
      ],
      nest_modules_by_prefix: [Zoonk, ZoonkWeb]
    ]
  end
end
