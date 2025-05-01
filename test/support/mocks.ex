defmodule Posthog.HTTPClient.Test do
  @behaviour Posthog.HTTPClient

  def post(_url, _body, _headers, _opts) do
    # Return mock responses for testing
    {:ok, %{status: 200, headers: [], body: %{}}}
  end
end
