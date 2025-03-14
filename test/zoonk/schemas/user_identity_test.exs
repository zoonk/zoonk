defmodule Zoonk.UserIdentityTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Repo
  alias Zoonk.Schemas.UserIdentity

  describe "UserIdentity.changeset/2" do
    test "adds an email identity" do
      user = user_fixture()
      email = unique_user_email()
      attrs = %{identity: :email, identity_id: email, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      assert changeset.valid?
    end

    test "adds a supported third-party identity" do
      user = user_fixture()
      uid = Ecto.UUID.generate()
      attrs = %{identity: :google, identity_id: uid, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      assert changeset.valid?
    end

    test "rejects an unsupported third-party identity" do
      user = user_fixture()
      uid = Ecto.UUID.generate()
      attrs = %{identity: :unsupported, identity_id: uid, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "is invalid" in errors_on(changeset).identity
    end

    test "gives an error if the identity is missing" do
      user = user_fixture()
      uid = Ecto.UUID.generate()
      attrs = %{identity: nil, identity_id: uid, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).identity
    end

    test "gives an error if the identity_id is missing" do
      user = user_fixture()
      attrs = %{identity: :google, identity_id: nil, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).identity_id
    end

    test "gives an error if the user_id is missing" do
      uid = Ecto.UUID.generate()
      attrs = %{identity: :google, identity_id: uid, user_id: nil}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).user_id
    end

    test "cannot have a duplicated email address" do
      user = user_fixture()
      email = unique_user_email()
      attrs = %{identity: :email, identity_id: email, user_id: user.id}

      # Create the first identity
      assert {:ok, %UserIdentity{}} =
               %UserIdentity{}
               |> UserIdentity.changeset(attrs)
               |> Repo.insert()

      # Attempt to create a second identity with the same email
      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      assert {:error, changeset} = Repo.insert(changeset)
      assert "has already been taken" in errors_on(changeset).identity
    end

    test "have a valid email address" do
      user = user_fixture()
      email = "invalid_email"
      attrs = %{identity: :email, identity_id: email, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "must have the @ sign and no spaces" in errors_on(changeset).identity_id
    end

    test "identity_id does not exceed 160 characters" do
      user = user_fixture()
      long_id = String.duplicate("a", 161)
      attrs = %{identity: :google, identity_id: long_id, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "should be at most 160 character(s)" in errors_on(changeset).identity_id
    end

    test "identity_id is at least 6 characters" do
      user = user_fixture()
      short_id = "short"
      attrs = %{identity: :google, identity_id: short_id, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "should be at least 6 character(s)" in errors_on(changeset).identity_id
    end

    test "identity_id is not an email for external accounts" do
      user = user_fixture()
      email = unique_user_email()
      attrs = %{identity: :google, identity_id: email, user_id: user.id}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "must NOT be an email address" in errors_on(changeset).identity_id
    end

    test "raises a constraint error if a user has two primary identities" do
      user = user_fixture()
      email1 = unique_user_email()
      attrs = %{identity: :email, identity_id: email1, user_id: user.id, is_primary: true}
      changeset1 = UserIdentity.changeset(%UserIdentity{}, attrs)
      assert {:ok, %UserIdentity{}} = Repo.insert(changeset1)

      # Raises when trying to create a second primary identity
      email2 = unique_user_email()
      attrs2 = %{identity: :email, identity_id: email2, user_id: user.id, is_primary: true}
      changeset2 = UserIdentity.changeset(%UserIdentity{}, attrs2)

      assert_raise Ecto.ConstraintError, fn -> Repo.insert!(changeset2) end

      # Allow to create a new non-primary identity
      email3 = unique_user_email()
      attrs3 = %{identity: :email, identity_id: email3, user_id: user.id, is_primary: false}
      changeset3 = UserIdentity.changeset(%UserIdentity{}, attrs3)
      assert {:ok, %UserIdentity{}} = Repo.insert(changeset3)
    end

    test "doesn't allow external accounts to be primary, only emails" do
      user = user_fixture()
      uid = Ecto.UUID.generate()
      attrs = %{identity: :google, identity_id: uid, user_id: user.id, is_primary: true}

      changeset = UserIdentity.changeset(%UserIdentity{}, attrs)
      refute changeset.valid?
      assert "only email identities can be primary" in errors_on(changeset).is_primary
    end
  end
end
