defmodule Zoonk.AccountsTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts
  alias Zoonk.Configuration
  alias Zoonk.Schemas.User
  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Schemas.UserProfile
  alias Zoonk.Schemas.UserToken

  describe "get_user_by_email/1" do
    test "does not return the user if the email does not exist" do
      refute Accounts.get_user_by_email("unknown@example.com")
    end

    test "returns the user if the email exists" do
      %{user: %User{id: id}, user_identity: %UserIdentity{identity_id: email}} = user_fixture()
      assert %User{id: ^id} = Accounts.get_user_by_email(email)
    end
  end

  describe "signup_user_with_email/1" do
    test "requires email to be set" do
      {:error, _field, changeset, _data} = Accounts.signup_user_with_email(%{identity: :email})
      assert %{identity_id: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates email when given" do
      {:error, _field, changeset, _data} =
        Accounts.signup_user_with_email(%{identity: :email, identity_id: "not valid"})

      assert %{identity_id: ["must have the @ sign and no spaces"]} = errors_on(changeset)
    end

    test "validates maximum values for identity_id for security" do
      too_long = String.duplicate("db", 100)
      {:error, _field, changeset, _data} = Accounts.signup_user_with_email(%{identity_id: too_long})
      assert "should be at most 160 character(s)" in errors_on(changeset).identity_id
    end

    test "validates identity_id uniqueness" do
      %{identity_id: identity_id} = user_fixture().user_identity
      {:error, _field, changeset, _data} = Accounts.signup_user_with_email(%{identity_id: identity_id})
      assert "has already been taken" in errors_on(changeset).identity_id

      # Now try with the upper cased identity_id too, to check that identity_id case is ignored.
      {:error, _field, uppercase_changeset, _data} =
        Accounts.signup_user_with_email(%{identity_id: String.upcase(identity_id)})

      assert "has already been taken" in errors_on(uppercase_changeset).identity_id
    end

    test "signs up users" do
      email = unique_user_email()

      {:ok,
       %{
         user: %User{} = user,
         user_identity: %UserIdentity{} = user_identity,
         user_profile: %UserProfile{} = user_profile
       }} =
        [email: email]
        |> valid_user_attributes()
        |> Accounts.signup_user_with_email()

      assert user_identity.user_id == user.id
      assert user_identity.identity == :email
      assert user_identity.identity_id == email
      assert user_identity.is_primary == true
      assert is_nil(user_identity.confirmed_at)
      assert user_profile.user_id == user.id
    end
  end

  describe "sudo_mode?/1" do
    test "validates the authenticated_at time" do
      sudo_mode_minutes = Configuration.get_max_age(:sudo_mode, :minutes)
      valid_minutes = sudo_mode_minutes + 1
      invalid_minutes = sudo_mode_minutes - 1

      now = DateTime.utc_now()

      assert Accounts.sudo_mode?(%UserIdentity{authenticated_at: DateTime.utc_now()})
      assert Accounts.sudo_mode?(%UserIdentity{authenticated_at: DateTime.add(now, valid_minutes, :minute)})
      refute Accounts.sudo_mode?(%UserIdentity{authenticated_at: DateTime.add(now, invalid_minutes, :minute)})

      # not authenticated
      refute Accounts.sudo_mode?(%UserIdentity{})
    end
  end

  describe "change_user_identity/3" do
    test "returns a user identity changeset" do
      assert %Ecto.Changeset{} = changeset = Accounts.change_user_identity(%UserIdentity{})
      assert changeset.required == [:identity]
    end
  end

  describe "deliver_user_update_email_instructions/3" do
    setup do
      %{user_identity: user_fixture().user_identity}
    end

    test "sends token through notification", %{user_identity: user_identity} do
      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(user_identity, "current@example.com", url)
        end)

      {:ok, new_token} = Base.url_decode64(token, padding: false)
      assert user_token = Repo.get_by(UserToken, token: :crypto.hash(:sha256, new_token))
      assert user_token.user_identity_id == user_identity.id
      assert user_token.sent_to == user_identity.identity_id
      assert user_token.context == "change:current@example.com"
    end
  end

  describe "update_user_email/2" do
    setup do
      %{user: %User{} = user, user_identity: %UserIdentity{} = user_identity} = unconfirmed_user_fixture()
      email = unique_user_email()

      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(
            %{user_identity | identity_id: email},
            user_identity.identity_id,
            url
          )
        end)

      %{user: user, user_identity: user_identity, token: token, email: email}
    end

    test "updates the email with a valid token", %{user: user, token: token, email: email} do
      assert Accounts.update_user_email(user, token) == :ok
      changed_user = Repo.get!(User, user.id)
      assert changed_user.email != user.email
      assert changed_user.email == email
      refute Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email with invalid token", %{user: user} do
      assert Accounts.update_user_email(user, "oops") == :error
      assert Repo.get!(User, user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email if user email changed", %{user_identity: user_identity, token: token} do
      assert Accounts.update_user_email(%{user_identity | identity_id: "current@example.com"}, token) == :error
      assert Repo.get!(UserIdentity, user_identity.id).identity_id == user_identity.identity_id
      assert Repo.get_by(UserToken, user_identity_id: user_identity.id)
    end

    test "does not update email if token expired", %{user: user, token: token} do
      {1, nil} = Repo.update_all(UserToken, set: [inserted_at: ~N[2020-01-01 00:00:00]])
      assert Accounts.update_user_email(user, token) == :error
      assert Repo.get!(User, user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end
  end

  describe "generate_user_session_token/1" do
    setup do
      %{user_identity: user_fixture().user_identity}
    end

    test "generates a token", %{user_identity: user_identity} do
      token = Accounts.generate_user_session_token(user_identity)
      assert user_token = Repo.get_by(UserToken, token: token)
      assert user_token.context == "session"

      # Creating the same token for another user should fail
      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(%UserToken{
          token: user_token.token,
          user_identity_id: user_fixture().user_identity.id,
          context: "session"
        })
      end
    end
  end

  describe "get_user_by_session_token/1" do
    setup do
      %{user: user, user_identity: user_identity} = user_fixture()
      token = Accounts.generate_user_session_token(user_identity)
      %{user: user, token: token}
    end

    test "returns user by token", %{user: %User{} = user, token: token} do
      assert session_user = Accounts.get_user_by_session_token(token)
      assert session_user.id == user.id
      assert session_user.profile.user_id == user.id
      assert session_user.profile.is_public == false
    end

    test "does not return user for invalid token" do
      refute Accounts.get_user_by_session_token("oops")
    end

    test "does not return user for expired token", %{token: token} do
      {1, nil} = Repo.update_all(UserToken, set: [inserted_at: ~N[2020-01-01 00:00:00]])
      refute Accounts.get_user_by_session_token(token)
    end
  end

  describe "get_user_by_magic_link_token/1" do
    setup do
      %{user: %User{} = user, user_identity: %UserIdentity{} = user_identity} = user_fixture()
      {encoded_token, _hashed_token} = generate_user_magic_link_token(user_identity)
      %{user: user, token: encoded_token}
    end

    test "returns user by token", %{user: user, token: token} do
      assert session_user = Accounts.get_user_by_magic_link_token(token)
      assert session_user.id == user.id
    end

    test "does not return user for invalid token" do
      refute Accounts.get_user_by_magic_link_token("oops")
    end

    test "does not return user for expired token", %{token: token} do
      {1, nil} = Repo.update_all(UserToken, set: [inserted_at: ~N[2020-01-01 00:00:00]])
      refute Accounts.get_user_by_magic_link_token(token)
    end
  end

  describe "login_user_by_magic_link/1" do
    test "confirms user and expires tokens" do
      %{user_identity: %UserIdentity{} = user_identity} = unconfirmed_user_fixture()
      refute user_identity.confirmed_at
      {encoded_token, hashed_token} = generate_user_magic_link_token(user_identity)

      assert {:ok, user_identity, [%{token: ^hashed_token}]} =
               Accounts.login_user_by_magic_link(encoded_token)

      assert user_identity.confirmed_at
    end

    test "returns user and (deleted) token for confirmed user" do
      %{user_identity: %UserIdentity{} = user_identity} = user_fixture()
      assert user_identity.confirmed_at
      {encoded_token, _hashed_token} = generate_user_magic_link_token(user_identity)
      assert {:ok, ^user_identity, []} = Accounts.login_user_by_magic_link(encoded_token)
      # one time use only
      assert {:error, :not_found} = Accounts.login_user_by_magic_link(encoded_token)
    end
  end

  describe "delete_user_session_token/1" do
    test "deletes the token" do
      token = Accounts.generate_user_session_token(user_fixture().user_identity)
      assert Accounts.delete_user_session_token(token) == :ok
      refute Accounts.get_user_by_session_token(token)
    end
  end

  describe "deliver_login_instructions/2" do
    setup do
      %{user: %User{} = user, user_identity: %UserIdentity{} = user_identity} = unconfirmed_user_fixture()
      %{user: user, user_identity: user_identity}
    end

    test "sends token through notification", %{user_identity: user_identity} do
      token = extract_user_token(fn url -> Accounts.deliver_login_instructions(user_identity, url) end)

      {:ok, new_token} = Base.url_decode64(token, padding: false)
      assert user_token = Repo.get_by(UserToken, token: :crypto.hash(:sha256, new_token))
      assert user_token.user_identity_id == user_identity.id
      assert user_token.sent_to == user_identity.identity_id
      assert user_token.context == "login"
    end
  end

  describe "login_with_external_account/2" do
    test "creates a new user and links the external account" do
      email = unique_user_email()
      picture = "https://zoonk.test/picture.png"
      uid = Ecto.UUID.generate()

      auth = oauth_fixture(%{uid: uid, email: email, picture: picture})

      {:ok, %UserIdentity{} = user_identity} = Accounts.login_with_external_account(auth, "en")

      assert user_identity.identity == :google
      assert user_identity.identity_id == uid

      user = Repo.get!(User, user_identity.user_id)
      user_profile = Repo.get_by!(UserProfile, user_id: user.id)

      assert user.language == :en

      assert user_profile.user_id == user.id
      assert user_profile.picture_url == picture
    end

    test "links the external account to an existing user" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()

      %{user: %User{} = existing_user} = user_fixture(%{identity_id: email})
      auth = oauth_fixture(%{uid: uid, email: email})

      {:ok, %User{} = user} = Accounts.login_with_external_account(auth, "en")

      assert user.id == existing_user.id

      user_identity = Repo.get_by!(UserIdentity, user_id: user.id)
      assert user_identity.identity == :google
      assert user_identity.identity_id == uid

      assert Repo.get_by!(UserProfile, user_id: user.id)
    end

    test "adds a second external account to an existing user" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()
      %{user: %User{} = user} = user_fixture(%{identity_id: email})

      external_account_1 = oauth_fixture(%{uid: uid, provider: :google, email: email})
      {:ok, _user} = Accounts.login_with_external_account(external_account_1, "en")
      assert Repo.get_by!(UserIdentity, user_id: user.id, identity: :google)

      external_account_2 = oauth_fixture(%{uid: uid, provider: :apple, email: email})
      {:ok, _user} = Accounts.login_with_external_account(external_account_2, "en")
      assert Repo.get_by!(UserIdentity, user_id: user.id, identity: :apple)
    end

    test "works with an integer uid" do
      email = unique_user_email()
      picture = "https://zoonk.test/picture.png"
      uid = 123_456

      auth = oauth_fixture(%{uid: uid, email: email, picture: picture})

      {:ok, %User{} = user} = Accounts.login_with_external_account(auth, "en")

      user_identity = Repo.get_by!(UserIdentity, user_id: user.id)
      assert user_identity.identity_id == to_string(uid)
    end

    test "adds name and username to profile when available" do
      name = "John Doe"
      username = "johndoe"

      auth = oauth_fixture(%{name: name, username: username})

      {:ok, %User{} = user} = Accounts.login_with_external_account(auth, "en")

      user_profile = Repo.get_by!(UserProfile, user_id: user.id)
      assert user_profile.display_name == name
      assert user_profile.username == username
    end

    test "ensure usernames are unique across identities" do
      email1 = unique_user_email()
      email2 = unique_user_email()
      username = "johndoe"

      auth1 = oauth_fixture(%{email: email1, provider: :google, username: username})
      auth2 = oauth_fixture(%{email: email2, provider: :apple, username: username})

      {:ok, %User{} = user1} = Accounts.login_with_external_account(auth1, "en")
      {:ok, %User{} = user2} = Accounts.login_with_external_account(auth2, "en")

      profile1 = Repo.get_by!(UserProfile, user_id: user1.id)
      profile2 = Repo.get_by!(UserProfile, user_id: user2.id)

      assert profile1.username == username
      assert profile2.username != username
      assert String.starts_with?(profile2.username, username)
    end
  end
end
