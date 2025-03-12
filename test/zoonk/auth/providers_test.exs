defmodule Zoonk.Accounts.ProvidersTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts.Providers
  alias Zoonk.Schemas.User
  alias Zoonk.Schemas.UserProfile
  alias Zoonk.Schemas.UserProvider

  describe "login_with_provider/2" do
    test "creates a new user and links the provider" do
      email = unique_user_email()
      picture = "https://zoonk.test/picture.png"
      uid = Ecto.UUID.generate()

      auth = oauth_fixture(%{uid: uid, email: email, picture: picture})

      {:ok, %User{} = user} = Providers.login_with_provider(auth, "en")

      assert user.email == email
      assert user.language == :en
      assert user.confirmed_at != nil

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      user_profile = Repo.get_by!(UserProfile, user_id: user.id)

      assert user_provider.provider == :google
      assert user_provider.provider_uid == uid

      assert user_profile.user_id == user.id
      assert user_profile.picture_url == picture
    end

    test "links the provider to an existing user" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()

      existing_user = user_fixture(%{email: email})
      auth = oauth_fixture(%{uid: uid, email: email})

      {:ok, user} = Providers.login_with_provider(auth, "en")

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

      {:ok, first_user} = Providers.login_with_provider(auth, "en")
      assert first_user.id == existing_user.id

      {:ok, user} = Providers.login_with_provider(auth, "en")

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

      provider1 = oauth_fixture(%{uid: uid, provider: :google, email: email})
      {:ok, _user} = Providers.login_with_provider(provider1, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :google)

      provider2 = oauth_fixture(%{uid: uid, provider: :apple, email: email})
      {:ok, _user} = Providers.login_with_provider(provider2, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :apple)
    end

    test "works with an integer uid" do
      email = unique_user_email()
      picture = "https://zoonk.test/picture.png"
      uid = 123_456

      auth = oauth_fixture(%{uid: uid, email: email, picture: picture})

      {:ok, %User{} = user} = Providers.login_with_provider(auth, "en")

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      assert user_provider.provider_uid == to_string(uid)
    end

    test "adds name and username to profile when available" do
      name = "John Doe"
      username = "johndoe"

      auth = oauth_fixture(%{name: name, username: username})

      {:ok, %User{} = user} = Providers.login_with_provider(auth, "en")

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

      {:ok, %User{} = user1} = Providers.login_with_provider(auth1, "en")
      {:ok, %User{} = user2} = Providers.login_with_provider(auth2, "en")

      profile1 = Repo.get_by!(UserProfile, user_id: user1.id)
      profile2 = Repo.get_by!(UserProfile, user_id: user2.id)

      assert profile1.username == username
      assert profile2.username != username
      assert String.starts_with?(profile2.username, username)
    end
  end
end
