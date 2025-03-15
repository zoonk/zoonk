defmodule Zoonk.Accounts.UserProfileBuilder do
  @moduledoc """
  Helper module for building user profiles.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Repo
  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Schemas.UserProfile

  @doc """
  Builds a `Zoonk.Schemas.UserProfile` based on the user's email address.

  This is useful for initializing a user profile when a new user signs up.

  ## Examples

      iex> build_initial_user_profile(%{identity: %UserIdentity{user_id: 1, identity_id: "leo@davinci.it"}})
      %UserProfile{username: "leo", user_id: 1}

      iex> build_initial_user_profile(%{identity: %UserIdentity{user_id: 2, identity_id: "leo@davinci.com"}})
      %UserProfile{username: "leo_1234566", user_id: 2}
  """
  def build_initial_user_profile(%{user_identity: %UserIdentity{user_id: user_id, identity_id: email}}, opts \\ []) do
    %UserProfile{
      display_name: opts[:display_name],
      picture_url: opts[:picture_url],
      username: get_username_from_email(opts[:username] || email),
      user_id: user_id
    }
  end

  defp get_username_from_email(email) do
    username =
      email
      |> String.split("@")
      |> List.first()

    available? = username_available?(username)
    build_initial_username(username, available?)
  end

  # If the username is already taken, we append a unique integer to it.
  defp build_initial_username(username, true), do: username
  defp build_initial_username(username, false), do: "#{username}_#{System.unique_integer([:positive])}"

  defp username_available?(username) do
    UserProfile
    |> where([p], p.username == ^username)
    |> Repo.exists?()
    |> Kernel.not()
  end
end
