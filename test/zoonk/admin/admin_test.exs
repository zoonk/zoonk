defmodule Zoonk.AdminTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Admin
  alias Zoonk.Schemas.AdminUser

  describe "add_admin/1" do
    test "adds a user as an admin" do
      %{user_profile: user_profile} = user_fixture()
      assert {:ok, %AdminUser{}} = Admin.add_admin(user_profile)
    end

    test "returns error when adding an existing admin" do
      %{user_profile: user_profile} = user_fixture()
      Admin.add_admin(user_profile)

      assert {:error, changeset} = Admin.add_admin(user_profile)
      assert changeset.valid? == false
    end
  end

  describe "admin?/1" do
    test "returns true for admin user" do
      %{user_profile: user_profile, user: user} = user_fixture()
      {:ok, _admin_user} = Admin.add_admin(user_profile)
      assert Admin.admin?(user)
    end

    test "returns false for non-admin user" do
      %{user: user} = user_fixture()
      refute Admin.admin?(user)
    end
  end
end
