defmodule Zoonk.Admin do
  @moduledoc """
  Context for admin management.

  This module provides functions to manage data
  without the need for additional permissions
  since only admin users can access pages where
  administrative tasks are performed.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Repo
  alias Zoonk.Schemas.AdminUser
  alias Zoonk.Schemas.User

  @doc """
  Check if a user is an admin.

  ## Examples

      iex> admin?(%User{})
      true

      iex> admin?(%User{})
      false
  """
  def admin?(%User{id: user_id}) do
    AdminUser
    |> where([a], a.user_id == ^user_id)
    |> Repo.exists?()
  end

  @doc """
  Adds a user as an admin.

  ## Examples

      iex> add_admin(user_id)
      {:ok, %AdminUser{}}

      iex> add_admin(user_id)
      {:error, %Ecto.Changeset{}}
  """
  def add_admin(user_id) do
    %AdminUser{}
    |> AdminUser.changeset(%{user_id: user_id})
    |> Repo.insert()
  end

  @doc """
  Returns the number of users registered on the platform.

  ## Examples

      iex> count_users()
      100
  """
  def count_users do
    User
    |> select([u], count(u.id))
    |> Repo.one()
  end
end
