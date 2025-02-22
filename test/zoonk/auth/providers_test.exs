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

      auth = %Ueberauth.Auth{uid: uid, provider: :google, info: %{email: email, image: image}}

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
      auth = %Ueberauth.Auth{uid: uid, provider: :google, info: %{email: email}}

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
      auth = %Ueberauth.Auth{uid: uid, provider: :google, info: %{email: email}}

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

      provider1 = %Ueberauth.Auth{uid: uid, provider: :google, info: %{email: email}}
      {:ok, _user} = Providers.signin_with_provider(provider1, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :google)

      provider2 = %Ueberauth.Auth{uid: uid, provider: :apple, info: %{email: email}}
      {:ok, _user} = Providers.signin_with_provider(provider2, "en")
      assert Repo.get_by!(UserProvider, user_id: user.id, provider: :apple)
    end
  end
end
