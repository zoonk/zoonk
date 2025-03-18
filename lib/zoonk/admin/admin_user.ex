defmodule Zoonk.Admin.AdminUser do
  @moduledoc """
  Represents an admin user in the system.

  Some users have permissions to perform administrative tasks
  like managing other users, viewing sensitive data, etc.

  This schema tracks all users with admin permissions.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `user_id` | `Integer` | The ID from `Zoonk.Accounts.User`. |
  | `inserted_at` | `DateTime` | Timestamp when the admin user was created. |
  | `updated_at` | `DateTime` | Timestamp when the admin user was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User

  schema "admin_users" do
    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc """
    A changeset for adding or updating an admin user.
  """
  def changeset(admin_user, attrs) do
    admin_user
    |> cast(attrs, [:user_id])
    |> validate_required([:user_id])
    |> unique_constraint(:user_id)
  end
end
