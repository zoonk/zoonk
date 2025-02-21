defmodule Zoonk.Schemas.UserProfile do
  @moduledoc """
  Defines the `UserProfile` schema and related changesets.

  A user can have one profile, which contains information
  that can become public if they set `public?` to true.

  ## Fields

    * `bio` - A short biography of the user.
    * `display_name` - The name displayed to other users.
    * `picture_url` - A URL to the user's profile picture.
    * `public?` - A boolean indicating if the profile is public.
    * `username` - The user's username (unique).

  ## Associations
    * `user` - The `Zoonk.Schemas.User` associated with this profile.

  ## Changesets
    * `changeset/2` - Validates and updates the profile fields.
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Schemas.User

  schema "user_profiles" do
    field :public?, :boolean, default: false
    field :bio, :string
    field :display_name, :string
    field :picture_url, :string
    field :username, :string

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user profile changeset for adding or updating a user's profile.
  """
  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [:bio, :display_name, :picture_url, :public?, :username, :user_id])
    |> validate_required([:public?, :username, :user_id])
    |> unique_constraint(:username)
  end
end
