defmodule Zoonk.AccountsTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Accounts
  alias Zoonk.Accounts.Subdomain
  alias Zoonk.Accounts.User
  alias Zoonk.Accounts.UserInterests
  alias Zoonk.Accounts.UserProfile
  alias Zoonk.Accounts.UserProvider
  alias Zoonk.Accounts.UserToken
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Repo
  alias Zoonk.Scope

  @sudo_mode_max_age_minutes Application.compile_env!(:zoonk, :user_token)[:max_age_minutes][:sudo_mode]

  describe "change_user_profile/2" do
    test "allows valid usernames" do
      valid = ["user", "my-a", "my_a", "mya23", "123mya", "my-a-123", "my_a_123", "MY-A"]

      for username <- valid do
        attrs = valid_user_profile_attributes(%{username: username})
        assert %Ecto.Changeset{valid?: true} = UserProfile.changeset(%UserProfile{}, attrs)
      end
    end

    test "rejects usernames with special characters" do
      invalid = ["my.a", "my@a", "my/a", "my\\a", "my:a", "my;a", "my,a", "my a"]

      for username <- invalid do
        attrs = valid_user_profile_attributes(%{username: username})
        assert %Ecto.Changeset{valid?: false} = changeset = UserProfile.changeset(%UserProfile{}, attrs)
        assert %{username: ["cannot have spaces for special characters"]} = errors_on(changeset)
      end
    end

    test "rejects usernames without letters" do
      invalid = ["123", "12_", "1--", "--", "__"]

      for username <- invalid do
        attrs = valid_user_profile_attributes(%{username: username})
        assert %Ecto.Changeset{valid?: false} = changeset = UserProfile.changeset(%UserProfile{}, attrs)
        assert %{username: ["must have letters"]} = errors_on(changeset)
      end
    end

    test "rejects reserved subdomains" do
      reserved = Enum.take_random(Subdomain.list_reserved_subdomains(), 10)

      for subdomain <- reserved do
        attrs = valid_user_profile_attributes(%{username: subdomain})
        assert %Ecto.Changeset{valid?: false} = changeset = UserProfile.changeset(%UserProfile{}, attrs)
        assert "is reserved" in errors_on(changeset).username
      end
    end
  end

  describe "update_user_profile/3" do
    setup do
      user = user_fixture(%{preload: :profile})
      %{profile: user.profile, scope: %Scope{user: user}}
    end

    test "updates profile with valid attributes", %{profile: profile, scope: scope} do
      update_attrs = %{display_name: "New Display Name", bio: "Updated bio"}

      assert {:ok, %UserProfile{} = updated_profile} = Accounts.update_user_profile(scope, profile, update_attrs)
      assert updated_profile.display_name == "New Display Name"
      assert updated_profile.bio == "Updated bio"
      assert updated_profile.id == profile.id
    end

    test "allows users to remove their existing display name by setting empty string", %{profile: profile, scope: scope} do
      # First set a display name
      {:ok, profile_with_name} = Accounts.update_user_profile(scope, profile, %{display_name: "Some Name"})
      assert profile_with_name.display_name == "Some Name"

      # Then remove it with empty string
      assert {:ok, %UserProfile{} = updated_profile} =
               Accounts.update_user_profile(scope, profile_with_name, %{display_name: ""})

      assert is_nil(updated_profile.display_name)
    end

    test "allows users to remove their existing display name by setting nil", %{profile: profile, scope: scope} do
      # First set a display name
      {:ok, profile_with_name} = Accounts.update_user_profile(scope, profile, %{display_name: "Some Name"})
      assert profile_with_name.display_name == "Some Name"

      # Then remove it with nil
      assert {:ok, %UserProfile{} = updated_profile} =
               Accounts.update_user_profile(scope, profile_with_name, %{display_name: nil})

      assert is_nil(updated_profile.display_name)
    end

    test "prevents long display names", %{profile: profile, scope: scope} do
      long_name = String.duplicate("a", 33)

      assert {:error, changeset} = Accounts.update_user_profile(scope, profile, %{display_name: long_name})
      assert %{display_name: ["should be at most 32 character(s)"]} = errors_on(changeset)
    end

    test "allows display names at the maximum length", %{profile: profile, scope: scope} do
      max_length_name = String.duplicate("a", 32)
      attrs = %{display_name: max_length_name}

      assert {:ok, %UserProfile{} = updated_profile} = Accounts.update_user_profile(scope, profile, attrs)
      assert updated_profile.display_name == max_length_name
    end

    test "returns error changeset with invalid username", %{profile: profile, scope: scope} do
      invalid_attrs = %{username: "invalid.username"}

      assert {:error, changeset} = Accounts.update_user_profile(scope, profile, invalid_attrs)
      assert %{username: ["cannot have spaces for special characters"]} = errors_on(changeset)
    end

    test "returns error changeset when username is already taken", %{profile: profile, scope: scope} do
      other_user = user_fixture(%{preload: :profile})
      taken_username = other_user.profile.username

      assert {:error, changeset} = Accounts.update_user_profile(scope, profile, %{username: taken_username})
      assert %{username: ["has already been taken"]} = errors_on(changeset)
    end

    test "returns error changeset when required fields are missing", %{profile: profile, scope: scope} do
      assert {:error, changeset} = Accounts.update_user_profile(scope, profile, %{username: nil})
      assert %{username: ["can't be blank"]} = errors_on(changeset)
    end

    test "returns error when trying to update profile of another user", %{profile: profile} do
      scope = scope_fixture()
      assert {:error, :unauthorized} = Accounts.update_user_profile(scope, profile, %{display_name: "New Name"})
    end
  end

  describe "change_user_interests/2" do
    test "allows valid interests" do
      valid_attrs = %{
        struggles: "math, focus",
        work_field: "software engineering",
        location: "New York",
        media: "Star Trek, The Office",
        hobbies: "gaming, reading",
        examples: "practical real-world applications"
      }

      assert %Ecto.Changeset{valid?: true} = UserInterests.changeset(%UserInterests{}, valid_attrs)
    end

    test "allows very long text fields" do
      long_text = String.duplicate("This is a very long text with lots of content that should be allowed. ", 500)

      valid_attrs = %{
        struggles: long_text,
        work_field: long_text,
        location: long_text,
        media: long_text,
        hobbies: long_text,
        examples: long_text
      }

      assert %Ecto.Changeset{valid?: true} = UserInterests.changeset(%UserInterests{}, valid_attrs)
    end

    test "allows empty strings and nil values" do
      valid_attrs = %{
        struggles: nil,
        work_field: nil,
        location: nil,
        media: "",
        hobbies: "",
        examples: nil
      }

      assert %Ecto.Changeset{valid?: true} = UserInterests.changeset(%UserInterests{}, valid_attrs)
    end
  end

  describe "get_user_interests/1" do
    test "returns nil when user has no interests" do
      user = user_fixture()
      scope = %Scope{user: user}
      refute Accounts.get_user_interests(scope)
    end

    test "returns user interests when they exist" do
      user = user_fixture()
      interests = user_interests_fixture(%{user: user})
      scope = %Scope{user: user}

      assert %UserInterests{id: interests_id} = Accounts.get_user_interests(scope)
      assert interests_id == interests.id
    end
  end

  describe "upsert_user_interests/2" do
    test "creates new interests when none exist" do
      user = user_fixture()
      scope = %Scope{user: user}
      interests_attrs = %{work_field: "engineering"}

      assert {:ok, %UserInterests{} = interests} = Accounts.upsert_user_interests(scope, interests_attrs)
      assert interests.work_field == "engineering"
      assert interests.user_id == user.id
    end

    test "updates existing interests" do
      user = user_fixture()
      existing_interests = user_interests_fixture(%{user: user})
      scope = %Scope{user: user}

      update_attrs = %{location: "San Francisco"}

      assert {:ok, %UserInterests{} = updated} = Accounts.upsert_user_interests(scope, update_attrs)
      assert updated.id == existing_interests.id
      assert updated.location == "San Francisco"
    end
  end

  describe "get_user_by_email/1" do
    test "does not return the user if the email does not exist" do
      refute Accounts.get_user_by_email("unknown@example.com")
    end

    test "returns the user if the email exists" do
      %{id: id} = user = user_fixture()
      assert %User{id: ^id} = Accounts.get_user_by_email(user.email)
    end
  end

  describe "signup_user/2" do
    setup do
      %{scope: scope_fixture(%{user: nil})}
    end

    test "requires email to be set", %{scope: scope} do
      {:error, changeset} = Accounts.signup_user(%{}, scope)
      assert %{email: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates email when given", %{scope: scope} do
      {:error, changeset} = Accounts.signup_user(%{email: "not valid"}, scope)

      assert %{email: ["must have the @ sign and no spaces"]} = errors_on(changeset)
    end

    test "validates maximum values for email for security", %{scope: scope} do
      too_long = String.duplicate("db", 100)
      {:error, changeset} = Accounts.signup_user(%{email: too_long}, scope)
      assert "should be at most 160 character(s)" in errors_on(changeset).email
    end

    test "validates email uniqueness", %{scope: scope} do
      %{email: email} = user_fixture()
      {:error, changeset} = Accounts.signup_user(%{email: email}, scope)
      assert "has already been taken" in errors_on(changeset).email

      # Now try with the upper cased email too, to check that email case is ignored.
      {:error, uppercase_changeset} = Accounts.signup_user(%{email: String.upcase(email)}, scope)
      assert "has already been taken" in errors_on(uppercase_changeset).email
    end

    test "signs up users", %{scope: scope} do
      email = unique_user_email()

      {:ok, user} =
        [email: email]
        |> valid_user_attributes()
        |> Accounts.signup_user(scope)

      assert user.email == email
      assert is_nil(user.confirmed_at)
      assert Repo.get_by(UserProfile, user_id: user.id)

      # Verify that an org member is created
      org_member = Repo.get_by(OrgMember, user_id: user.id, org_id: scope.org.id)
      assert org_member.role == :member
    end

    test "doesn't allow to signup to an org when sign up is not allowed" do
      # empty allowed_domains means no signup allowed
      scope = scope_fixture(%{kind: :external, settings: %{allowed_domains: []}})

      {:error, changeset} =
        %{email: "user@zoonk.test"}
        |> valid_user_attributes()
        |> Accounts.signup_user(scope)

      assert_error(changeset, :email, "You can't signup with this email address")
      assert_error(changeset, :email, "zoonk.test")
    end

    test "doesn't allow to sign up to an org with a not allowed domain" do
      scope = scope_fixture(%{kind: :external, settings: %{allowed_domains: ["allowed.com"]}})

      {:error, changeset} =
        %{email: "user@invalid.com"}
        |> valid_user_attributes()
        |> Accounts.signup_user(scope)

      assert_error(changeset, :email, "You can't signup with this email address")
      assert_error(changeset, :email, "invalid.com")
    end

    test "allows to sign up to an org with an allowed domain" do
      scope = scope_fixture(%{kind: :external, settings: %{allowed_domains: ["allowed.com"]}})

      {:ok, user} =
        %{email: "user@allowed.com"}
        |> valid_user_attributes()
        |> Accounts.signup_user(scope)

      assert user.email == "user@allowed.com"
      assert Repo.get_by(UserProfile, user_id: user.id)
    end

    test "always allows to sign up to system orgs" do
      scope = scope_fixture(%{kind: :system, settings: %{allowed_domains: []}})
      {:ok, user} = Accounts.signup_user(valid_user_attributes(), scope)
      assert Repo.get_by(UserProfile, user_id: user.id)
    end

    test "always allows to sign up to public external orgs" do
      scope = scope_fixture(%{kind: :external, is_public: true, settings: %{allowed_domains: []}})
      {:ok, user} = Accounts.signup_user(valid_user_attributes(), scope)
      assert Repo.get_by(UserProfile, user_id: user.id)
    end
  end

  describe "sudo_mode?/1" do
    test "validates the authenticated_at time" do
      valid_minutes = @sudo_mode_max_age_minutes + 1
      invalid_minutes = @sudo_mode_max_age_minutes - 1

      now = DateTime.utc_now()

      assert Accounts.sudo_mode?(%User{authenticated_at: DateTime.utc_now()})
      assert Accounts.sudo_mode?(%User{authenticated_at: DateTime.add(now, valid_minutes, :minute)})
      refute Accounts.sudo_mode?(%User{authenticated_at: DateTime.add(now, invalid_minutes, :minute)})

      # not authenticated
      refute Accounts.sudo_mode?(%User{})
    end
  end

  describe "change_user_email/3" do
    test "returns a user changeset" do
      assert %Ecto.Changeset{} = changeset = Accounts.change_user_email(%User{})
      assert changeset.required == [:email]
    end
  end

  describe "deliver_user_update_email_instructions/3" do
    setup do
      %{user: user_fixture()}
    end

    test "sends token through notification", %{user: user} do
      otp_code = extract_otp_code(Accounts.deliver_user_update_email_instructions(user, "current@example.com"))

      assert user_token = Repo.get_by(UserToken, token: :crypto.hash(:sha256, otp_code))
      assert user_token.user_id == user.id
      assert user_token.sent_to == user.email
      assert user_token.context == "change:current@example.com"
    end
  end

  describe "update_user_email/2" do
    setup do
      user = unconfirmed_user_fixture()
      email = unique_user_email()

      otp_code = extract_otp_code(Accounts.deliver_user_update_email_instructions(%{user | email: email}, user.email))

      %{user: user, code: otp_code, email: email}
    end

    test "updates the email with a valid OTP code", %{user: user, code: otp_code, email: email} do
      assert Accounts.update_user_email(user, otp_code) == :ok
      changed_user = Repo.get!(User, user.id)
      assert changed_user.email != user.email
      assert changed_user.email == email
      refute Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email with invalid OTP code", %{user: user} do
      assert Accounts.update_user_email(user, "oops") == :error
      assert Repo.get!(User, user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email if user email changed", %{user: user, code: otp_code} do
      assert Accounts.update_user_email(%{user | email: "current@example.com"}, otp_code) == :error
      assert Repo.get!(User, user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end

    test "does not update email if OTP code expired", %{user: user, code: otp_code} do
      {1, nil} = Repo.update_all(UserToken, set: [inserted_at: ~N[2020-01-01 00:00:00]])
      assert Accounts.update_user_email(user, otp_code) == :error
      assert Repo.get!(User, user.id).email == user.email
      assert Repo.get_by(UserToken, user_id: user.id)
    end
  end

  describe "generate_user_session_token/1" do
    setup do
      %{user: user_fixture()}
    end

    test "generates a token", %{user: user} do
      token = Accounts.generate_user_session_token(user)
      assert user_token = Repo.get_by(UserToken, token: token)
      assert user_token.context == "session"
      assert user_token.authenticated_at

      # Creating the same token for another user should fail
      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(%UserToken{
          token: user_token.token,
          user_id: user_fixture().id,
          context: "session"
        })
      end
    end

    test "duplicates the authenticated_at of given user in new token", %{user: user} do
      user = %{user | authenticated_at: DateTime.add(DateTime.utc_now(), -3600)}
      token = Accounts.generate_user_session_token(user)
      assert user_token = Repo.get_by(UserToken, token: token)
      assert user_token.authenticated_at == user.authenticated_at
      assert DateTime.after?(user_token.inserted_at, user.authenticated_at)
    end
  end

  describe "generate_user_session_token/2" do
    setup do
      %{user: user_fixture()}
    end

    test "generates an encoded token", %{user: user} do
      token = Accounts.generate_user_session_token(user, decoded: false)
      decoded_token = Base.url_decode64!(token, padding: false)
      assert user_token = Repo.get_by(UserToken, token: decoded_token)
      assert user_token.context == "session"
      assert user_token.authenticated_at

      # Creating the same token for another user should fail
      assert_raise Ecto.ConstraintError, fn ->
        Repo.insert!(%UserToken{
          token: user_token.token,
          user_id: user_fixture().id,
          context: "session"
        })
      end
    end
  end

  describe "get_user_by_session_token/1" do
    setup do
      user = user_fixture()
      token = Accounts.generate_user_session_token(user)
      %{user: user, token: token}
    end

    test "returns user by token", %{user: user, token: token} do
      assert {session_user, token_inserted_at} = Accounts.get_user_by_session_token(token)
      assert session_user.id == user.id
      assert session_user.authenticated_at
      assert token_inserted_at
      assert session_user.profile.user_id == user.id
      assert session_user.profile.is_public == false
    end

    test "returns user by encoded token", %{user: user, token: token} do
      encoded_token = Base.url_encode64(token, padding: false)
      assert {session_user, _token_inserted_at} = Accounts.get_user_by_session_token(encoded_token)
      assert session_user.id == user.id
    end

    test "does not return user for invalid token" do
      refute Accounts.get_user_by_session_token("oops")
    end

    test "does not return user for expired token", %{token: token} do
      dt = ~N[2020-01-01 00:00:00]
      {1, nil} = Repo.update_all(UserToken, set: [inserted_at: dt, authenticated_at: dt])
      refute Accounts.get_user_by_session_token(token)
    end
  end

  describe "login_user_by_otp/2" do
    test "confirms user and expires tokens" do
      user = unconfirmed_user_fixture()
      refute user.confirmed_at
      otp_code = generate_user_otp_code(user)

      assert {:ok, user, [%{token: _expired_token}]} = Accounts.login_user_by_otp(otp_code, user.email)
      assert user.confirmed_at
    end

    test "returns user and (deleted) token for confirmed user" do
      user = user_fixture()
      assert user.confirmed_at
      otp_code = generate_user_otp_code(user)
      assert {:ok, ^user, []} = Accounts.login_user_by_otp(otp_code, user.email)
      # one time use only
      assert {:error, :not_found} = Accounts.login_user_by_otp(otp_code, user.email)
    end

    test "login the correct user if multiple users have the same code" do
      user1 = user_fixture()
      user2 = user_fixture()
      otp_code = generate_user_otp_code(user1)

      # Simulate the same OTP code for both users
      Repo.insert!(%UserToken{
        token: otp_code,
        context: "login",
        sent_to: user2.email,
        user_id: user2.id
      })

      assert {:ok, ^user1, []} = Accounts.login_user_by_otp(otp_code, user1.email)
      assert {:error, :not_found} = Accounts.login_user_by_otp(otp_code, user2.email)
    end
  end

  describe "delete_user_session_token/1" do
    test "deletes the token" do
      user = user_fixture()
      token = Accounts.generate_user_session_token(user)
      assert Accounts.delete_user_session_token(token) == :ok
      refute Accounts.get_user_by_session_token(token)
    end

    test "handles encoded tokens" do
      user = user_fixture()
      token = Accounts.generate_user_session_token(user, decoded: false)
      assert Accounts.delete_user_session_token(token) == :ok
      refute Accounts.get_user_by_session_token(token)
    end
  end

  describe "deliver_login_instructions/2" do
    setup do
      %{user: unconfirmed_user_fixture()}
    end

    test "sends OTP code through notification", %{user: user} do
      otp_code = extract_otp_code(Accounts.deliver_login_instructions(user))

      assert user_token = Repo.get_by(UserToken, token: :crypto.hash(:sha256, otp_code))
      assert user_token.user_id == user.id
      assert user_token.sent_to == user.email
      assert user_token.context == "login"
    end
  end

  describe "login_with_provider/2" do
    test "creates a new user and links the provider for the :system org" do
      email = unique_user_email()
      picture = "https://zoonk.test/picture.png"
      uid = Ecto.UUID.generate()

      auth = oauth_fixture(%{uid: uid, email: email, picture: picture})
      scope = scope_fixture(%{kind: :system, user: nil, settings: %{allowed_domains: []}})

      {:ok, %User{} = user} = Accounts.login_with_provider(auth, scope, "en")

      assert user.email == email
      assert user.language == :en
      assert user.confirmed_at

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      user_profile = Repo.get_by!(UserProfile, user_id: user.id)

      assert user_provider.provider == :google
      assert user_provider.provider_uid == uid

      assert user_profile.user_id == user.id
      assert user_profile.picture_url == picture

      # Verify that an org member is created
      org_member = Repo.get_by(OrgMember, user_id: user.id, org_id: scope.org.id)
      assert org_member.role == :member
    end

    test "creates a new user for public orgs" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()

      auth = oauth_fixture(%{uid: uid, email: email})
      org = org_fixture(%{is_public: true, kind: :external})
      scope = scope_fixture(%{user: nil, org: org})

      assert {:ok, %User{} = user} = Accounts.login_with_provider(auth, scope, "en")
      assert user.email == email
    end

    test "doesn't create user if org doesn't allow sign up" do
      # empty allowed_domains means no signup allowed
      scope = scope_fixture(%{kind: :external, settings: %{allowed_domains: []}})

      email = unique_user_email()
      uid = Ecto.UUID.generate()

      auth = oauth_fixture(%{uid: uid, email: email})
      assert {:error, changeset} = Accounts.login_with_provider(auth, scope, "en")
      assert_error(changeset, :email, "You can't signup with this email address")
    end

    test "doesn't create user if an org doesn't allow sign up with a not allowed domain" do
      scope = scope_fixture(%{kind: :external, settings: %{allowed_domains: ["allowed.com"]}})

      email = unique_user_email()
      uid = Ecto.UUID.generate()

      auth = oauth_fixture(%{uid: uid, email: email})
      assert {:error, changeset} = Accounts.login_with_provider(auth, scope, "en")
      assert_error(changeset, :email, "You can't signup with this email address")
    end

    test "creates user if org allows sign up with an allowed domain" do
      scope = scope_fixture(%{kind: :external, settings: %{allowed_domains: ["allowed.com"]}})

      email = "#{System.unique_integer()}@allowed.com"
      uid = Ecto.UUID.generate()

      auth = oauth_fixture(%{uid: uid, email: email})
      {:ok, user} = Accounts.login_with_provider(auth, scope, "en")

      assert user.email == email
    end

    test "links the provider to an existing user" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()

      existing_user = user_fixture(%{email: email})
      auth = oauth_fixture(%{uid: uid, email: email})
      scope = scope_fixture(%{user: existing_user})

      {:ok, user} = Accounts.login_with_provider(auth, scope, "en")

      assert user.id == existing_user.id

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      assert user_provider.provider == :google
      assert user_provider.provider_uid == uid

      assert Repo.get_by!(UserProfile, user_id: user.id)
    end

    test "ignore duplicate provider" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()

      existing_user = user_fixture(%{email: email})
      auth = oauth_fixture(%{uid: uid, email: email})
      scope = scope_fixture(%{user: existing_user})

      {:ok, first_user} = Accounts.login_with_provider(auth, scope, "en")
      assert first_user.id == existing_user.id

      {:ok, user} = Accounts.login_with_provider(auth, scope, "en")

      assert user.id == existing_user.id

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      assert user_provider.provider == :google
      assert user_provider.provider_uid == uid

      assert Repo.get_by!(UserProfile, user_id: user.id)
    end

    test "adds a second provider to an existing user" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()
      user = user_fixture(%{email: email})
      scope = scope_fixture(%{user: user})

      provider1 = oauth_fixture(%{uid: uid, provider: :google, email: email})
      {:ok, _user} = Accounts.login_with_provider(provider1, scope, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :google)

      provider2 = oauth_fixture(%{uid: uid, provider: :apple, email: email})
      {:ok, _user} = Accounts.login_with_provider(provider2, scope, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :apple)
    end

    test "works with an integer uid" do
      email = unique_user_email()
      picture = "https://zoonk.test/picture.png"
      uid = 123_456

      auth = oauth_fixture(%{uid: uid, email: email, picture: picture})
      scope = scope_fixture(%{user: nil})

      {:ok, %User{} = user} = Accounts.login_with_provider(auth, scope, "en")

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      assert user_provider.provider_uid == to_string(uid)
    end

    test "adds name and username to profile when available" do
      name = "John Doe"
      username = "johndoe"

      auth = oauth_fixture(%{name: name, username: username})
      scope = scope_fixture(%{user: nil})

      {:ok, %User{} = user} = Accounts.login_with_provider(auth, scope, "en")

      user_profile = Repo.get_by!(UserProfile, user_id: user.id)
      assert user_profile.display_name == name
      assert user_profile.username == username
    end

    test "avoid duplicated usernames from provider" do
      email1 = unique_user_email()
      email2 = unique_user_email()
      username = "johndoe"

      auth1 = oauth_fixture(%{email: email1, provider: :google, username: username})
      auth2 = oauth_fixture(%{email: email2, provider: :apple, username: username})

      scope1 = scope_fixture(%{user: nil})

      {:ok, %User{} = user1} = Accounts.login_with_provider(auth1, scope1, "en")

      scope2 = scope_fixture(%{user: user1})
      {:ok, %User{} = user2} = Accounts.login_with_provider(auth2, scope2, "en")

      profile1 = Repo.get_by!(UserProfile, user_id: user1.id)
      profile2 = Repo.get_by!(UserProfile, user_id: user2.id)

      assert profile1.username == username
      assert profile2.username != username
      assert String.starts_with?(profile2.username, username)
    end
  end

  describe "OTP code rate limiting" do
    test "refuses to generate more than allowed OTP codes per hour for login" do
      user = user_fixture()
      max_codes = UserToken.get_max_otp_codes_per_hour()

      # Generate allowed number of codes
      Enum.each(1..max_codes, fn _code ->
        assert {:ok, _otp_code} = UserToken.build_otp_code(user, "login")
      end)

      # Try one more, should be rate limited
      assert {:error, :rate_limit_exceeded} = UserToken.build_otp_code(user, "login")
    end

    test "rate limit is per context" do
      user = user_fixture()
      max_codes = UserToken.get_max_otp_codes_per_hour()

      # Generate max codes for login
      Enum.each(1..max_codes, fn _code ->
        assert {:ok, _otp_code} = UserToken.build_otp_code(user, "login")
      end)

      # Should still allow codes for different contexts
      assert {:ok, _otp_code} = UserToken.build_otp_code(user, "change:test@example.com")
    end

    test "rate limit resets after one hour" do
      user = user_fixture()
      max_codes = UserToken.get_max_otp_codes_per_hour()

      # Generate max codes
      Enum.each(1..max_codes, fn _code ->
        assert {:ok, _otp_code} = UserToken.build_otp_code(user, "login")
      end)

      # Set inserted_at to more than an hour ago for all tokens
      {_int, nil} =
        UserToken
        |> where([t], t.user_id == ^user.id)
        |> Repo.update_all(set: [inserted_at: DateTime.add(DateTime.utc_now(), -2, :hour)])

      # Should be able to generate new codes
      assert {:ok, _otp_code} = UserToken.build_otp_code(user, "login")
    end
  end
end
