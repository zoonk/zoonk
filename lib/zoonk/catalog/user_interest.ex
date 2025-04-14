defmodule Zoonk.Catalog.UserInterest do
  @moduledoc """
  Defines the `UserInterest` schema.

  This schema represents the association between users and their interests.
  It's used to track which interests a user has selected for personalization.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `user_id` | `Integer` | The ID of the user. |
  | `interest_id` | `Integer` | The ID of the interest. |
  | `inserted_at` | `DateTime` | Timestamp when the association was created. |
  | `updated_at` | `DateTime` | Timestamp when the association was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Catalog.Interest

  schema "user_interests" do
    belongs_to :user, User
    belongs_to :interest, Interest

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(user_interest, attrs) do
    user_interest
    |> cast(attrs, [:user_id, :interest_id])
    |> validate_required([:user_id, :interest_id])
    |> unique_constraint([:user_id, :interest_id])
  end
end
