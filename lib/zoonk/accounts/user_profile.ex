defmodule Zoonk.Accounts.UserProfile do
  @moduledoc """
  Defines the `UserProfile` schema and related changesets.

  A user can have one profile, which contains information
  that can become public if they set `is_public` to true.

  We keep profiles separate from `Zoonk.Accounts.User` to prevent
  other people from accessing the user's sensitive information.

  ## Fields

  | Field Name    | Type      | Description                              |
  |---------------|-----------|------------------------------------------|
  | `is_public`   | `Boolean` | Indicates if the profile is public.      |
  | `bio`         | `String`  | A short biography of the user.           |
  | `display_name`| `String`  | The name displayed to other users.       |
  | `picture_url` | `String`  | URL of the user's profile picture.       |
  | `username`    | `String`  | Username used to view a user's profile.  |
  | `user_id`     | `Integer` | The ID from `Zoonk.Accounts.User`.       |
  | `inserted_at` | `DateTime`| Timestamp when the profile was created.  |
  | `updated_at`  | `DateTime`| Timestamp when the profile was updated.  |
  """
  use Ecto.Schema
  use Gettext, backend: Zoonk.Gettext

  import Ecto.Changeset

  alias Zoonk.Accounts.Subdomain
  alias Zoonk.Accounts.User

  schema "user_profiles" do
    field :is_public, :boolean, default: false
    field :bio, :string
    field :display_name, :string
    field :picture_url, :string
    field :username, :string

    belongs_to :user, User

    timestamps(type: :utc_datetime_usec)
  end

  @doc """
  A user profile changeset for adding or updating a user's profile.
  """
  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [:bio, :display_name, :picture_url, :is_public, :username])
    |> validate_required([:is_public, :username])
    |> validate_length(:display_name, max: 32)
    |> validate_format(:username, ~r/^[a-zA-Z0-9_-]+$/,
      message: dgettext("errors", "cannot have spaces for special characters")
    )
    |> validate_format(:username, ~r/[a-zA-Z]/, message: dgettext("errors", "must have letters"))
    |> validate_exclusion(:username, Subdomain.list_reserved_subdomains())
    |> unique_constraint(:username)
  end
end
