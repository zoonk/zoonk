defmodule Zoonk.CatalogTest do
  @moduledoc false
  use Zoonk.DataCase, async: true

  alias Zoonk.AccountFixtures
  alias Zoonk.Catalog
  alias Zoonk.CatalogFixtures

  describe "user_enrolled_in_any_course?/1" do
    test "returns true when user is enrolled in at least one course" do
      user = AccountFixtures.user_fixture()
      _course_user = CatalogFixtures.course_user_fixture(%{user: user})

      assert Catalog.user_enrolled_in_any_course?(user.id)
    end

    test "returns false when user is not enrolled in any course" do
      user = AccountFixtures.user_fixture()

      refute Catalog.user_enrolled_in_any_course?(user.id)
    end

    test "returns false for a non-existent user id" do
      non_existent_user_id = 999_999

      refute Catalog.user_enrolled_in_any_course?(non_existent_user_id)
    end
  end
end
