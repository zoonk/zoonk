defmodule Zoonk.AgeCheckerTest do
  @moduledoc false
  use Zoonk.DataCase

  alias Zoonk.AgeChecker

  describe "is_authorized?/1" do
    test "returns true if the user is at least 13 years old" do
      date_of_birth = Date.utc_today() |> Date.add(-365 * 13)
      assert AgeChecker.is_authorized?(date_of_birth) == true
    end

    test "returns false if the user is less than 13 years old" do
      date_of_birth = Date.utc_today() |> Date.add(-365 * 12)
      assert AgeChecker.is_authorized?(date_of_birth) == false
    end
  end
end
