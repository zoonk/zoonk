defmodule Zoonk.Admin do
  @moduledoc """
  Context for admin management.

  This module provides functions to manage data
  without the need for additional permissions
  since only admin users can access pages where
  administrative tasks are performed.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Accounts.User
  alias Zoonk.Admin.AdminUser
  alias Zoonk.Repo

  @doc """
  Check if a user is an admin.

  ## Examples

      iex> admin_user?(%User{})
      true

      iex> admin_user?(%User{})
      false
  """
  def admin_user?(%User{id: user_id}) do
    AdminUser
    |> where([a], a.user_id == ^user_id)
    |> Repo.exists?()
  end

  @doc """
  Creates an admin user.

  ## Examples

      iex> create_admin_user(user_id)
      {:ok, %AdminUser{}}

      iex> create_admin_user(user_id)
      {:error, %Ecto.Changeset{}}
  """
  def create_admin_user(user_id) do
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

  @doc """
  Returns a list of users.

  ## Examples

      iex> list_users()
      [%User{}, ...]

      iex> list_users(limit: 10, offset: 0)
      [%User{}, ...]
  """
  def list_users(opts \\ []) do
    User
    |> where([u], u.kind == :regular)
    |> order_by([u], desc: u.updated_at)
    |> limit(^opts[:limit])
    |> offset(^opts[:offset])
    |> preload([u], :profile)
    |> Repo.all()
  end
end
