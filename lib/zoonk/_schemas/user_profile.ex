defmodule Zoonk.Schemas.UserProfile do
  @moduledoc """
  Defines the `UserProfile` schema and related changesets.

  A user can have one profile, which contains information
  that can become public if they set `public?` to true.

  We keep profiles separate from `Zoonk.Schemas.User` to prevent
  other people from accessing the user's sensitive information.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `public?` | `boolean` | Indicates if the profile is public. |
  | `bio` | `string` | A short biography of the user. |
  | `display_name` | `string` | The name displayed to other users. |
  | `picture_url` | `string` | URL of the user's profile picture. |
  | `username` | `string` | Unique username used to view a user's profile. |
  | `user_id` | `integer` | The ID from `Zoonk.Schemas.User`. |
  | `city_id` | `integer` | The ID from `Zoonk.Schemas.City`. |
  | `inserted_at` | `DateTime` | Timestamp when the profile was created. |
  | `updated_at` | `DateTime` | Timestamp when the profile was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Schemas.City
  alias Zoonk.Schemas.User

  schema "user_profiles" do
    field :public?, :boolean, default: false
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
    |> cast(attrs, [:bio, :display_name, :picture_url, :public?, :username, :city_id, :user_id])
    |> validate_required([:public?, :username, :user_id])
    |> unique_constraint(:username)
  end
end
