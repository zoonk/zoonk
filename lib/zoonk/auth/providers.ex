defmodule Zoonk.Auth.Providers do
  @moduledoc """
  Handles user authentication via third-party providers.

  Provides functions for signing in users with providers
  like Google, Apple, GitHub, etc.

  It handles both signing in existing users and
  registering new users.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Auth
  alias Zoonk.Auth.UserProfileBuilder
  alias Zoonk.Helpers
  alias Zoonk.Repo
  alias Zoonk.Schemas.User
  alias Zoonk.Schemas.UserProvider

  @doc """
  Signs in a user with a third-party provider.

  It either links the provider to an existing user
  or registers a new user and links the provider.

  ## Examples

      iex> signin_with_provider(%{}, "en")
      {:ok, %User{}}

      iex> signin_with_provider(nil, "en")
      {:error, %Ecto.Changeset{}}
  """
  def signin_with_provider(auth, language) do
    user = Auth.get_user_by_email(auth["email"])

    case signin_with_provider(auth, language, user) do
      {:ok, %User{} = new_user} -> {:ok, new_user}
      {:ok, %UserProvider{}} -> {:ok, user}
      {:error, changeset} -> {:error, changeset}
    end
  end

  # Create a new user if it doesn't exist
  defp signin_with_provider(auth, language, nil) do
    register_user_with_provider(auth, language)
  end

  # If the user exists, then link the provider
  defp signin_with_provider(auth, _lang, %User{} = user) do
    %{user: user}
    |> user_provider_changeset(get_provider_attrs(auth))
    |> Repo.insert(on_conflict: :nothing)
  end

  # Create a new user and link the provider
  defp register_user_with_provider(auth, language) do
    user_attrs = %{email: auth["email"], language: language}
    provider_attrs = get_provider_attrs(auth)
    profile_opts = [display_name: auth["name"], picture_url: auth["picture"], username: auth["preferred_username"]]

    user_changeset =
      %User{}
      |> User.settings_changeset(user_attrs)
      |> User.confirm_changeset()

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, user_changeset)
    |> Ecto.Multi.insert(:profile, &UserProfileBuilder.build_initial_user_profile(&1, profile_opts))
    |> Ecto.Multi.insert(:provider, &user_provider_changeset(&1, provider_attrs))
    |> Repo.transaction()
    |> Helpers.EctoUtils.get_changeset_from_transaction(:user)
  end

  defp user_provider_changeset(%{user: %User{} = user}, provider_attrs) do
    UserProvider.changeset(%UserProvider{user_id: user.id}, provider_attrs)
  end

  defp get_provider_attrs(auth) do
    %{provider: auth["provider"], provider_uid: to_string(auth["sub"])}
  end
end
