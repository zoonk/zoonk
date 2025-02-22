defmodule Zoonk.Schemas.User do
  @moduledoc """
  Defines the `User` schema and related changesets.

  This schema represents users in the system, storing their
  email and account confirmation status. It also includes
  changeset functions for managing user registration,
  email validation, and account confirmation.

  ## Fields

    * `year_of_birth` - The user's year of birth. We use this to determine
      the user's age to see if they are eligible for certain features.
    * `kind` - The type of user.
      * `:regular` - A regular user.
      * `:agent` - AI agent used to create content.
      * `:guest` - A user who has not registered yet.
      * `:white_label` - A user who created an account through a white label partner.
    * `email` - The user's email address.
    * `language` - The user's preferred language.
    * `confirmed_at` - The timestamp when the account was confirmed.
    * `authenticated_at` (virtual) - The last authentication timestamp, used temporarily.

  ## Changesets

    * `settings_changeset/3` - Validates and updates the user's settings.
    * `email_changeset/3` - Validates and updates the email
    field, ensuring it is unique and correctly formatted.
    * `confirm_changeset/1` - Marks the account as confirmed
    by setting `confirmed_at`.
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Configuration
  alias Zoonk.Schemas.UserProfile
  alias Zoonk.Schemas.UserProvider

  schema "users" do
    field :year_of_birth, :integer
    field :kind, Ecto.Enum, values: [:regular, :agent, :guest, :white_label], default: :regular
    field :email, :string
    field :stripe_customer_id, :string

    field :language, Ecto.Enum,
      values: Configuration.supported_language_keys(),
      default: Configuration.default_language_key()

    field :confirmed_at, :utc_datetime
    field :authenticated_at, :utc_datetime, virtual: true

    has_one :profile, UserProfile
    has_many :providers, UserProvider

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user changeset for adding or updating a user's settings.
  """
  def settings_changeset(user, attrs, opts \\ []) do
    user
    |> email_changeset(attrs, opts)
    |> cast(attrs, [:language])
    |> validate_required([:language])
  end

  @doc """
  A user changeset for registering or changing the email.

  It requires the email to change otherwise an error is added.

  ## Options

    * `:validate_email` - Set to false if you don't want to validate the
      uniqueness of the email, useful when displaying live validations.
      Defaults to `true`.
  """
  def email_changeset(user, attrs, opts \\ []) do
    user
    |> cast(attrs, [:email])
    |> validate_email(opts)
  end

  defp validate_email(changeset, opts) do
    changeset =
      changeset
      |> validate_required([:email])
      |> validate_format(:email, ~r/^[^@,;\s]+@[^@,;\s]+$/, message: "must have the @ sign and no spaces")
      |> validate_length(:email, max: 160)

    if Keyword.get(opts, :validate_email, true) do
      changeset
      |> unsafe_validate_unique(:email, Zoonk.Repo)
      |> unique_constraint(:email)
      |> validate_email_changed()
    else
      changeset
    end
  end

  defp validate_email_changed(changeset) do
    if get_field(changeset, :email) && get_change(changeset, :email) == nil do
      add_error(changeset, :email, "did not change")
    else
      changeset
    end
  end

  @doc """
  Confirms the account by setting `confirmed_at`.
  """
  def confirm_changeset(user) do
    now = DateTime.utc_now(:second)
    change(user, confirmed_at: now)
  end
end
