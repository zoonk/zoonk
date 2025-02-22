defmodule Zoonk.Auth.ProvidersTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AuthFixtures

  alias Zoonk.Auth.Providers
  alias Zoonk.Schemas.User
  alias Zoonk.Schemas.UserProfile
  alias Zoonk.Schemas.UserProvider

  describe "signin_with_provider/2" do
    test "creates a new user and links the provider" do
      email = unique_user_email()
      image = "https://zoonk.test/image.png"
      uid = Ecto.UUID.generate()

      auth = ueberauth_fixture(%{uid: uid, email: email, image: image})

      {:ok, %User{} = user} = Providers.signin_with_provider(auth, "en")

      assert user.email == email
      assert user.language == :en
      assert user.confirmed_at != nil

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      user_profile = Repo.get_by!(UserProfile, user_id: user.id)

      assert user_provider.provider == :google
      assert user_provider.provider_uid == uid

      assert user_profile.user_id == user.id
      assert user_profile.picture_url == image
    end

    test "links the provider to an existing user" do
      email = unique_user_email()
      uid = Ecto.UUID.generate()

      existing_user = user_fixture(%{email: email})
      auth = ueberauth_fixture(%{uid: uid, email: email})

      {:ok, user} = Providers.signin_with_provider(auth, "en")

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
      auth = ueberauth_fixture(%{uid: uid, email: email})

      {:ok, first_user} = Providers.signin_with_provider(auth, "en")
      assert first_user.id == existing_user.id

      {:ok, user} = Providers.signin_with_provider(auth, "en")

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

      provider1 = ueberauth_fixture(%{uid: uid, provider: :google, email: email})
      {:ok, _user} = Providers.signin_with_provider(provider1, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :google)

      provider2 = ueberauth_fixture(%{uid: uid, provider: :apple, email: email})
      {:ok, _user} = Providers.signin_with_provider(provider2, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :apple)
    end

    test "works with an integer uid" do
      email = unique_user_email()
      image = "https://zoonk.test/image.png"
      uid = 123_456

      auth = ueberauth_fixture(%{uid: uid, email: email, image: image})

      {:ok, %User{} = user} = Providers.signin_with_provider(auth, "en")

      user_provider = Repo.get_by!(UserProvider, user_id: user.id)
      assert user_provider.provider_uid == to_string(uid)
    end

    test "adds name and username to profile when available" do
      name = "John Doe"
      username = "johndoe"

      auth = ueberauth_fixture(%{name: name, nickname: username})

      {:ok, %User{} = user} = Providers.signin_with_provider(auth, "en")

      user_profile = Repo.get_by!(UserProfile, user_id: user.id)
      assert user_profile.display_name == name
      assert user_profile.username == username
    end

    test "avoid duplicated usernames from provider" do
      email1 = unique_user_email()
      email2 = unique_user_email()
      username = "johndoe"

      auth1 = ueberauth_fixture(%{email: email1, provider: :google, nickname: username})
      auth2 = ueberauth_fixture(%{email: email2, provider: :apple, nickname: username})

      {:ok, %User{} = user1} = Providers.signin_with_provider(auth1, "en")
      {:ok, %User{} = user2} = Providers.signin_with_provider(auth2, "en")

      profile1 = Repo.get_by!(UserProfile, user_id: user1.id)
      profile2 = Repo.get_by!(UserProfile, user_id: user2.id)

      assert profile1.username == username
      assert profile2.username != username
      assert String.starts_with?(profile2.username, username)
    end
  end
end
