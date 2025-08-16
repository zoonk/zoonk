defmodule Zoonk.AI.AIClient.ClientConfig do
  @moduledoc """
  Configuration module for AI clients.
  """

  @timeout_ms 10 * 60 * 1000

  @doc """
  Get options for `Req` requests.
  """
  def req_opts(payload, config_key) do
    req_opts = [
      json: payload,
      receive_timeout: @timeout_ms,
      connect_options: [timeout: @timeout_ms],
      retry: :transient,
      max_retries: 10
    ]

    Keyword.merge(req_opts, Application.get_env(:zoonk, :ai)[config_key] || [])
  end
end
