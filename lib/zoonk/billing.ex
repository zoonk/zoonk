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
      {:ok, [
        %Price{plan: :starter_monthly, periodicity: :monthly, currencies: %{usd: 500, brl: 1999}},
        %Price{plan: :starter_yearly, periodicity: :yearly, currencies: %{usd: 5000, brl: 19990}},
        # ... more prices
      ]}

      iex> list_prices()
      {:error, "Failed to fetch prices"}
  """
  def list_prices do
    lookup_keys = ~w[
      starter_monthly starter_yearly starter_lifetime
      plus_monthly    plus_yearly    plus_lifetime
      premium_monthly premium_yearly premium_lifetime
    ]

    params =
      [
        {"active", true},
        {"expand[]", "data.currency_options"}
        | Enum.map(lookup_keys, &{"lookup_keys[]", &1})
      ]

    case Stripe.get("/prices", params) do
      {:ok, %{"data" => prices}} ->
        transformed_prices =
          prices
          |> Enum.map(&Price.transform_from_stripe/1)
          # remove invalid prices
          |> Enum.reject(&is_nil/1)

        {:ok, transformed_prices}

      {:error, message} ->
        {:error, message}
    end
  end
end
