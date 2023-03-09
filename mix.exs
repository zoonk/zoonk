defmodule Zoonk.MixProject do
  use Mix.Project

  def project do
    [
      app: :zoonk,
      version: "0.1.0",
      elixir: "~> 1.14",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      dialyzer: [
        plt_file: {:no_warn, "priv/plts/dialyzer.plt"},
        ignore_warnings: ".dialyzer_ignore.exs"
      ]
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
      {:credo, "~> 1.6.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.2.0", only: [:dev, :test], runtime: false},
      {:ecto_sql, "~> 3.9.2"},
      {:esbuild, "~> 0.6.1", runtime: Mix.env() == :dev},
      {:finch, "~> 0.14"},
      {:floki, ">= 0.34.2", only: :test},
      {:gettext, "~> 0.22.1"},
      {:heroicons, "~> 0.5.2"},
      {:jason, "~> 1.4"},
      {:mix_audit, "~> 2.1.0", only: [:dev, :test], runtime: false},
      {:phoenix_ecto, "~> 4.4"},
      {:phoenix_html, "~> 3.3.1"},
      {:phoenix_live_dashboard, "~> 0.7.2"},
      {:phoenix_live_reload, "~> 1.4.1", only: :dev},
      {:phoenix_live_view, "~> 0.18.16"},
      {:phoenix, "~> 1.7.1", override: true},
      {:plug_cowboy, "~> 2.6"},
      {:postgrex, ">= 0.16.5"},
      {:sobelow, "~> 0.11.1", only: [:dev, :test], runtime: false},
      {:swoosh, "~> 1.9.1"},
      {:tailwind, "~> 0.1.10", runtime: Mix.env() == :dev},
      {:telemetry_metrics, "~> 0.6.1"},
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
      "assets.build": ["tailwind default", "esbuild default"],
      "assets.deploy": ["tailwind default --minify", "esbuild default --minify", "phx.digest"],
      ci: [
        "compile --all-warnings --warnings-as-errors",
        "format --check-formatted",
        "credo --strict",
        "sobelow -i Config.Headers",
        "deps.audit",
        "dialyzer"
      ]
    ]
  end
end
