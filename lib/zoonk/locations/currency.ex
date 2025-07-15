defmodule Zoonk.Locations.Currency do
  @moduledoc """
  Represents currency information.
  """
  @enforce_keys [:code, :name, :symbol]
  defstruct [:code, :name, :symbol]

  @type t :: %__MODULE__{
          code: String.t(),
          name: String.t(),
          symbol: String.t()
        }
end
