defmodule Zoonk.Locations.Currency do
  @moduledoc """
  Represents currency information.
  """
  @enforce_keys [:code, :name]
  defstruct [:code, :name]

  @type t :: %__MODULE__{
          code: String.t(),
          name: String.t()
        }
end
