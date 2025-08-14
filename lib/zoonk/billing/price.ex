defmodule Zoonk.Billing.Price do
  @moduledoc """
  Represents a pricing option for a subscription plan.

  ## Fields

  | Field           | Type           | Description                               |
  |-----------------|----------------|-------------------------------------------|
  | plan            | `t:plan/0`     | The subscription plan                     |
  | interval        | `t:interval/0` | Payment frequency                         |
  | currency        | `String`       | The currency code (e.g., "usd", "brl")    |
  | value           | `String`       | The price value in the specified currency |
  | stripe_price_id | `String`       | The Stripe price ID for this plan         |
  """
  alias Zoonk.Locations

  @default_currency "usd"
  @default_value "$10"

  @type plan :: :plus | :pro
  @type interval :: :monthly | :yearly

  @type t :: %__MODULE__{
          plan: plan,
          interval: interval,
          currency: String.t(),
          value: String.t(),
          stripe_price_id: String.t()
        }

  defstruct plan: :plus,
            interval: :monthly,
            currency: @default_currency,
            value: @default_value,
            stripe_price_id: nil

  @doc """
  Transforms a Stripe Price object into a Price struct for a specific currency.

  Takes a raw Price object from the Stripe API and converts it to our internal
  Price struct, extracting the plan, interval, and price for the specified currency.
  If the currency is not available, falls back to USD, and if USD is not available,
  returns an error.

  For more information about the Stripe Price object structure, see:
  https://docs.stripe.com/api/prices/object

  ## Examples

      iex> transform_from_stripe(%{
      ...>   "lookup_key" => "plus_monthly",
      ...>   "currency_options" => %{
      ...>     "usd" => %{"unit_amount" => 500},
      ...>     "brl" => %{"unit_amount" => 1999}
      ...>   }
      ...> }, "brl")
      {:ok, %Price{
        plan: :plus,
        interval: :monthly,
        currency: "brl",
        value: "R$19.99"
      }}
  """
  def transform_from_stripe(price, preferred \\ @default_currency) do
    all_currencies = extract_currencies(price["currency_options"])
    user_currency = get_currency(all_currencies, preferred)

    %__MODULE__{
      plan: get_plan(price["lookup_key"]),
      interval: get_interval(price),
      currency: user_currency,
      value: Map.get(all_currencies, user_currency, @default_value),
      stripe_price_id: price["id"]
    }
  end

  @doc """
  Extracts currency information from Stripe's currency_options.

  Converts the raw currency data from Stripe's format to a map of
  currency strings to decimal prices. The unit_amount from Stripe is
  in cents, so it's divided by 100 to get the actual price.

  This is a helper function used internally by transform_from_stripe.

  ## Examples

      iex> extract_currencies(%{
      ...>   "usd" => %{"unit_amount" => 500},
      ...>   "brl" => %{"unit_amount" => 1999}
      ...> })
      %{"usd" => "$5.00", "brl" => "R$19.99"}
  """
  def extract_currencies(currencies) when is_map(currencies) do
    Map.new(currencies, fn {currency, data} ->
      {currency, format_price(data["unit_amount"] / 100, currency)}
    end)
  end

  def extract_currencies(_currencies), do: %{}

  defp get_currency(currencies, preferred) when is_map_key(currencies, preferred), do: preferred
  defp get_currency(_currencies, _preferred), do: @default_currency

  defp get_plan(lookup_key) do
    lookup_key
    |> String.split("_")
    |> List.first()
    |> String.to_existing_atom()
  end

  defp get_interval(price) do
    price["lookup_key"]
    |> String.split("_")
    |> List.last()
    |> String.to_existing_atom()
  end

  defp format_price(value) do
    value
    |> :erlang.float_to_binary(decimals: 2)
    |> String.replace_suffix(".00", "")
  end

  defp format_price(value, currency) do
    Locations.currency_symbol(currency) <> format_price(value)
  end
end
