defmodule Zoonk.Billing do
  @moduledoc """
  Handles billing operations for the application.

  This context provides functions for managing subscriptions, processing payments,
  and integrating with payment providers such as Stripe.
  """

  alias Zoonk.Billing.Stripe

  @doc """
  Lists all available pricing options for plans.

  Returns a list of prices for all plan options (starter, plus, premium)
  with all payment periodicities (monthly, yearly, lifetime).

  ## Examples

      iex> list_prices()
      {:ok, [
        %{id: "price_123", lookup_key: "starter_monthly", unit_amount: 500},
        %{id: "price_456", lookup_key: "starter_yearly", unit_amount: 5000},
        # ... more prices
      ]}

      iex> list_prices()
      {:error, "Failed to fetch prices"}
  """
  def list_prices do
    lookup_keys = [
      # Starter plan
      "starter_monthly",
      "starter_yearly",
      "starter_lifetime",
      # Plus plan
      "plus_monthly",
      "plus_yearly",
      "plus_lifetime",
      # Premium plan
      "premium_monthly",
      "premium_yearly",
      "premium_lifetime"
    ]

    params =
      [
        {"active", true}
        | Enum.map(lookup_keys, fn key -> {"lookup_keys[]", key} end)
      ]

    case Stripe.get("/prices", params) do
      {:ok, %{"data" => prices}} -> {:ok, prices}
      {:error, message} -> {:error, message}
    end
  end
end
