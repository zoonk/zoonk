defmodule Zoonk.Billing.Price do
  @moduledoc """
  Represents a pricing option for a subscription plan.

  ## Fields

  | Field       | Type     | Description                                             |
  |-------------|----------|---------------------------------------------------------|
  | plan        | `Atom`   | The subscription plan (e.g., :starter, :plus, :premium) |
  | periodicity | `Atom`   | Payment frequency (:monthly, :yearly, :lifetime)        |
  | currencies  | `Map`    | Available currencies with their respective prices       |
  """
  alias Zoonk.Helpers

  @type t :: %__MODULE__{
          plan: atom(),
          periodicity: atom(),
          currencies: %{atom() => float()}
        }

  defstruct plan: nil,
            periodicity: nil,
            currencies: %{}

  @doc """
  Transforms a Stripe Price object into a Price struct.

  Takes a raw Price object from the Stripe API and converts it to our internal
  Price struct, extracting the plan, periodicity, and available currencies.

  For more information about the Stripe Price object structure, see:
  https://docs.stripe.com/api/prices/object

  ## Examples

      iex> transform_from_stripe(%{
      ...>   "lookup_key" => "starter_monthly",
      ...>   "currency_options" => %{
      ...>     "usd" => %{"unit_amount" => 500},
      ...>     "brl" => %{"unit_amount" => 1999}
      ...>   }
      ...> })
      %Price{
        plan: :starter_monthly,
        periodicity: :monthly,
        currencies: %{usd: 5.0, brl: 19.99}
      }
  """
  def transform_from_stripe(price) do
    # Only return prices with valid lookup keys
    if plan = Helpers.to_existing_atom(price["lookup_key"]) do
      periodicity =
        price["lookup_key"]
        |> String.split("_")
        |> List.last()
        |> Helpers.to_existing_atom()

      # Extract currencies from currency_options
      currencies = extract_currencies(price["currency_options"])

      %__MODULE__{
        plan: plan,
        periodicity: periodicity,
        currencies: currencies
      }
    end
  end

  @doc """
  Extracts currency information from Stripe's currency_options.

  Converts the raw currency data from Stripe's format to a map of
  currency atoms to decimal prices. The unit_amount from Stripe is
  in cents, so it's divided by 100 to get the actual price.

  ## Examples

      iex> extract_currencies(%{
      ...>   "usd" => %{"unit_amount" => 500},
      ...>   "brl" => %{"unit_amount" => 1999}
      ...> })
      %{usd: 5.0, brl: 19.99}
  """
  def extract_currencies(currencies) when is_map(currencies) do
    Map.new(currencies, fn {currency, data} ->
      {Helpers.to_existing_atom(currency), data["unit_amount"] / 100}
    end)
  end

  def extract_currencies(_currencies), do: %{}
end
