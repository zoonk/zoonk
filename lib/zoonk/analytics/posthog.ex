defmodule Zoonk.Analytics.PostHog do
  @moduledoc """
  PostHog client for Zoonk.

  This module provides a simple interface to interact with the PostHog API.
  """

  @api_url Application.compile_env(:posthog, :api_url)
  @api_key Application.compile_env(:posthog, :api_key)
  @capture? Application.compile_env(:posthog, :enabled_capture, true)

  @capture_endpoint "#{@api_url}/i/v0/e/"

  @doc """
  Captures an event.

  ## Examples

      iex> PostHog.capture(event, distinct_id, properties)
      :ok

      iex> PostHog.capture("user_signup", "user_123", %{plan: "premium"})
      :error
  """
  def capture(event, distinct_id, properties \\ %{}) do
    if @capture? do
      payload = %{
        api_key: @api_key,
        event: event,
        distinct_id: distinct_id,
        properties: properties
      }

      case Req.post(@capture_endpoint, json: payload) do
        {:ok, _response} ->
          :ok

        {:error, error} ->
          {:error, error}
      end
    else
      :ok
    end
  end
end
