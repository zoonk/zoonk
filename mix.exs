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
      compilers: [:phoenix_live_view] ++ Mix.compilers(),
      listeners: [Phoenix.CodeReloader],

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
      {:bandit, "~> 1.7"},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dns_cluster, "~> 0.2.0"},
      {:ecto_sql, "~> 3.13"},
      {:esbuild, "~> 0.10", runtime: Mix.env() == :dev},
      {:ex_doc, "~> 0.37", only: :dev, runtime: false},
      {:floki, "~> 0.38", only: :test},
      {:gettext, "~> 0.26"},
      {:jason, "~> 1.2"},
      {:lazy_html, ">= 0.1.0", only: :test},
      {:mix_audit, "~> 2.1", only: [:dev, :test], runtime: false},
      {:mix_test_watch, "~> 1.2", only: [:dev, :test], runtime: false},
      {:oban, "~> 2.19"},
      {:phoenix_ecto, "~> 4.5"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      {:phoenix_live_reload, "~> 1.2", only: :dev},
      {:phoenix_live_view, "~> 1.1.4"},
      {:phoenix_test, "~> 0.7.1", only: :test, runtime: false},
      {:phoenix, "~> 1.8.0"},
      {:postgrex, ">= 0.0.0"},
      {:req, "~> 0.5.0"},
      {:sobelow, "~> 0.13", only: [:dev, :test], runtime: false},
      {:styler, "~> 1.7", only: [:dev, :test], runtime: false},
      {:swoosh, "~> 1.5"},
      # Using the main branch instead of tags because of the size. Using the tag had over 1gb. Using a branch has less than 60mb.
      {:tabler_icons,
       github: "tabler/tabler-icons", branch: "main", sparse: "icons", app: false, compile: false, depth: 1},
      {:tailwind, "~> 0.3", runtime: Mix.env() == :dev},
      {:tailwind_formatter, "~> 0.4.2", only: [:dev, :test], runtime: false},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.0"},
      {:tidewave, "~> 0.3", only: :dev}
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
        "deps.audit"
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
      nest_modules_by_prefix: [Zoonk, ZoonkWeb]
    ]
  end
end
