defmodule Zoonk.Billing do
  @moduledoc """
  Handles billing operations for the application.

  This context provides functions for managing subscriptions, processing payments,
  and integrating with payment providers such as Stripe.
  """

  alias Zoonk.Billing.Price
  alias Zoonk.Billing.Stripe

  @doc """
  Lists all available pricing options for plans.

  Returns a list of prices for all plan options (starter, plus, premium)
  with all payment periodicities (monthly, yearly, lifetime).

  ## Examples

      iex> list_prices()
      {:ok, [%Price{}]}

      iex> list_prices()
      {:error, "Failed to fetch prices"}
  """
  def list_prices do
    "/prices"
    |> Stripe.get(stripe_price_params())
    |> list_prices()
  end

  defp list_prices({:ok, %{"data" => prices}}) do
    {:ok, Enum.map(prices, &Price.transform_from_stripe/1)}
  end

  defp list_prices({:error, message}), do: {:error, message}

  defp stripe_price_params do
    [
      {"active", true},
      {"expand[]", "data.currency_options"}
      | Enum.map(stripe_lookup_keys(), &{"lookup_keys[]", &1})
    ]
  end

  defp stripe_lookup_keys do
    ~w[
      starter_monthly starter_yearly starter_lifetime
      plus_monthly    plus_yearly    plus_lifetime
      premium_monthly premium_yearly premium_lifetime
    ]
  end
end
