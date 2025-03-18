defmodule Zoonk.AdminTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Admin
  alias Zoonk.Admin.AdminUser

  describe "create_admin_user/1" do
    test "adds a user as an admin" do
      user = user_fixture()
      assert {:ok, %AdminUser{}} = Admin.create_admin_user(user.id)
    end

    test "returns error when adding an existing admin" do
      user = user_fixture()
      Admin.create_admin_user(user.id)

      assert {:error, changeset} = Admin.create_admin_user(user.id)
      assert changeset.valid? == false
    end
  end

  describe "admin_user?/1" do
    test "returns true for admin user" do
      user = user_fixture()
      {:ok, _admin_user} = Admin.create_admin_user(user.id)
      assert Admin.admin_user?(user)
    end

    test "returns false for non-admin user" do
      user = user_fixture()
      refute Admin.admin_user?(user)
    end
  end
end
