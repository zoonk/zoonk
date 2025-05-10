defmodule Zoonk.Billing.Stripe do
  @moduledoc """
  Stripe API client for Zoonk.

  This module provides functions to interact with the Stripe API, including
  creating, retrieving, and managing Stripe resources.
  """

  @base_url "https://api.stripe.com/v1"
  @api_version "2025-04-30.basil"

  @doc """
  Sends a `GET` request to the Stripe API.

  ## Parameters
  - `endpoint`: The Stripe API endpoint to send the request to.
  - `params`: Optional query parameters for the request.
  - `opts`: Additional options for the request, such as headers.

  ## Examples

      iex> Stripe.get("/prices")
      {:ok, %{data: [%{id: "price_1J2Y3Z4A5B6C7D8E9F0G", product: "prod_1A2B3C4D", unit_amount: 1000}]}}

      iex> Stripe.get("/prices", %{lookup_keys: ["starter_monthly"]})
      {:ok, %{data: [%{id: "price_1J2Y3Z4A5B6C7D8E9F0G", lookup_key: "starter_monthly", unit_amount: 1000}]}}
  """
  def get(endpoint, params \\ %{}, opts \\ []) do
    [url: parse_url(endpoint), params: params]
    |> Req.new()
    |> Req.Request.merge_options(stripe_opts())
    |> Req.Request.merge_options(opts)
    |> Req.Request.put_header("Stripe-Version", @api_version)
    |> Req.get()
    |> handle_response()
  end

  @doc """
  Sends a `POST` request to the Stripe API.

  ## Parameters
  - `endpoint`: The Stripe API endpoint to send the request to.
  - `payload`: The payload to include in the request body.
  - `opts`: Additional options for the request, such as headers and query parameters.

  ## Examples

      iex> Stripe.post("/charges", %{amount: 1000, currency: "usd"})
      {:ok, %{id: "ch_1J2Y3Z4A5B6C7D8E9F0G", amount: 1000, currency: "usd"}}

      iex> Stripe.post("/charges", %{amount: 1000, currency: "usd"})
      {:error, "Invalid request"}
  """
  def post(endpoint, payload, opts \\ []) do
    [url: parse_url(endpoint), form: payload]
    |> Req.new()
    |> Req.Request.merge_options(stripe_opts())
    |> Req.Request.merge_options(opts)
    |> Req.Request.put_header("Stripe-Version", @api_version)
    |> Req.post()
    |> handle_response()
  end

  @doc """
  Sends a `DELETE` request to the Stripe API.

  ## Parameters
  - `endpoint`: The Stripe API endpoint to send the request to.
  - `params`: Optional query parameters for the request.
  - `opts`: Additional options for the request, such as headers.

  ## Examples

      iex> Stripe.delete("/subscriptions/sub_1J2Y3Z4A5B6C7D8E9F0G")
      {:ok, %{id: "sub_1J2Y3Z4A5B6C7D8E9F0G", status: "canceled"}}

      iex> Stripe.delete("/subscriptions/invalid_id")
      {:error, "No such subscription: invalid_id"}
  """
  def delete(endpoint, params \\ %{}, opts \\ []) do
    [url: parse_url(endpoint), params: params]
    |> Req.new()
    |> Req.Request.merge_options(stripe_opts())
    |> Req.Request.merge_options(opts)
    |> Req.Request.put_header("Stripe-Version", @api_version)
    |> Req.delete()
    |> handle_response()
  end

  defp handle_response({:ok, %Req.Response{body: %{"error" => error}}}) do
    {:error, error["message"]}
  end

  defp handle_response({:ok, %Req.Response{body: body}}) do
    {:ok, body}
  end

  defp handle_response({:error, error}) do
    {:error, error}
  end

  defp parse_url(endpoint), do: "#{@base_url}#{endpoint}"

  defp stripe_opts do
    Application.get_env(:zoonk, :stripe)[:opts] || []
  end
end
