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
        transformed_prices = Enum.map(prices, &transform_price_to_struct/1)
        {:ok, transformed_prices}

      {:error, message} ->
        {:error, message}
    end
  end

  defp transform_price_to_struct(price) do
    # Extract the plan key from lookup_key
    plan = String.to_existing_atom(price["lookup_key"])

    # Extract periodicity from lookup_key suffix (after the last underscore)
    periodicity =
      price["lookup_key"]
      |> String.split("_")
      |> List.last()
      |> String.to_existing_atom()

    # Extract currencies from currency_options
    currencies = extract_currencies(price["currency_options"])

    %Price{
      plan: plan,
      periodicity: periodicity,
      currencies: currencies
    }
  end

  defp extract_currencies(currencies) when is_map(currencies) do
    Map.new(currencies, fn {currency, data} ->
      {String.to_existing_atom(currency), data["unit_amount"] / 100}
    end)
  end

  defp extract_currencies(_currencies), do: %{}
end
