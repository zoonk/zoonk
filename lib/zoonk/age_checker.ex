defmodule Zoonk.AgeChecker do
  @moduledoc """
  Check a user's age and if they have reached the required age to access this application.
  """

  @spec is_authorized?(Date.t()) :: boolean
  def is_authorized?(date_of_birth) do
    thirteen_years_ago = Date.utc_today() |> Date.add(-365 * 13)
    Date.compare(date_of_birth, thirteen_years_ago) != :gt
  end
end
