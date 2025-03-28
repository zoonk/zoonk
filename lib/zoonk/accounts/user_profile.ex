defmodule Zoonk.Accounts.UserProfile do
  @moduledoc """
  Defines the `UserProfile` schema and related changesets.

  A user can have one profile, which contains information
  that can become public if they set `is_public` to true.

  We keep profiles separate from `Zoonk.Accounts.User` to prevent
  other people from accessing the user's sensitive information.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `is_public` | `Boolean` | Indicates if the profile is public. |
  | `bio` | `String` | A short biography of the user. |
  | `display_name` | `String` | The name displayed to other users. |
  | `picture_url` | `String` | URL of the user's profile picture. |
  | `username` | `String` | Unique username used to view a user's profile. |
  | `user_id` | `Integer` | The ID from `Zoonk.Accounts.User`. |
  | `city_id` | `Integer` | The ID from `Zoonk.Locations.City`. |
  | `inserted_at` | `DateTime` | Timestamp when the profile was created. |
  | `updated_at` | `DateTime` | Timestamp when the profile was last updated. |
  """
  use Ecto.Schema
  use Gettext, backend: Zoonk.Gettext

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Locations.City

  schema "user_profiles" do
    field :is_public, :boolean, default: false
    field :bio, :string
    field :display_name, :string
    field :picture_url, :string
    field :username, :string

    belongs_to :user, User
    belongs_to :city, City

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user profile changeset for adding or updating a user's profile.
  """
  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [:bio, :display_name, :picture_url, :is_public, :username, :city_id, :user_id])
    |> validate_required([:is_public, :username, :user_id])
    |> validate_format(:username, ~r/^[a-zA-Z0-9_-]+$/,
      message: dgettext("errors", "cannot have spaces for special characters")
    )
    |> validate_format(:username, ~r/[a-zA-Z]/, message: dgettext("errors", "must have letters"))
    |> unique_constraint(:username)
  end
end
