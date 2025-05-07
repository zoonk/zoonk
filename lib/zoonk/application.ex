defmodule Zoonk.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl Application
  def start(_type, _args) do
    Oban.Telemetry.attach_default_logger()

    children = [
      ZoonkWeb.Telemetry,
      Zoonk.Repo,
      {Oban, Application.fetch_env!(:zoonk, Oban)},
      {DNSCluster, query: Application.get_env(:zoonk, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Zoonk.PubSub},
      # Start a worker by calling: Zoonk.Worker.start_link(arg)
      # {Zoonk.Worker, arg},
      # Start to serve requests, typically the last entry
      ZoonkWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Zoonk.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl Application
  def config_change(changed, _new, removed) do
    ZoonkWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
