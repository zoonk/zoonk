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
      {:ok, %Req.Response{}}

      iex> PostHog.capture("user_signup", "user_123", %{plan: "premium"})
      {:error, error}
  """
  def capture(event, distinct_id, properties \\ %{}) do
    payload = %{api_key: @api_key, event: event, distinct_id: distinct_id, properties: properties}
    post(@capture_endpoint, payload)
  end

  def post(endpoint, payload) do
    if @capture? do
      Req.post(endpoint, json: payload)
    else
      {:ok, %Req.Response{status: 200}}
    end
  end
end
