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

  @type t :: %__MODULE__{
          plan: atom(),
          periodicity: atom(),
          currencies: %{atom() => float()}
        }

  defstruct plan: nil,
            periodicity: nil,
            currencies: %{}
end
