defmodule Zoonk.Schemas.User do
  @moduledoc """
  Defines the `User` schema.

  This schema represents users in the system, storing their
  email and account confirmation status. It also includes
  changeset functions for managing user signup,
  email validation, and account confirmation.

  For public information, we use the `Zoonk.Schemas.UserProfile` schema instead.

  ## User Types

  | Type | Description |
  |------|-------------|
  | `:regular` | Regular users who signed up on the main platform. |
  | `:agent` | AI bots and agents. |
  | `:guest` | Users who didn't create an account. |
  | `:white_label` | Users who signed up from a partner platform. |

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `year_of_birth` | `integer` | We need the year of birth for legal reasons when a profile is public. |
  | `currency` | `Ecto.Enum` | The currency used for payments. |
  | `kind` | `Ecto.Enum` | Users can have different types: `regular`, `agent`, `guest`, or `white_label`. |
  | `email` | `string` | The user's email address. |
  | `stripe_customer_id` | `string` | Customer ID used for Stripe payments. |
  | `tax_id` | `Zoonk.Encrypted.Binary` | Tax ID required by some jurisdictions. |
  | `language` | `Ecto.Enum` | The language used by the user. |
  | `confirmed_at` | `utc_datetime` | Timestamp when the account was confirmed. |
  | `authenticated_at` | `utc_datetime` | Timestamp when the user was last authenticated. |
  | `profile` | `Zoonk.Schemas.UserProfile` | The user's public profile. |
  | `identities` | `Zoonk.Schemas.UserIdentity` | Identities used by the user for authentication. |
  | `teams` | `Zoonk.Schemas.Member` | The teams the user is a member of. |
  | `inserted_at` | `DateTime` | Timestamp when the user was created. |
  | `updated_at` | `DateTime` | Timestamp when the user was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Configuration
  alias Zoonk.Schemas.Member
  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Schemas.UserProfile

  schema "users" do
    field :year_of_birth, :integer
    field :currency, Ecto.Enum, values: Configuration.list_currencies(:atom), default: :USD
    field :kind, Ecto.Enum, values: [:regular, :agent, :guest, :white_label], default: :regular
    field :email, :string
    field :stripe_customer_id, :string
    field :tax_id, Zoonk.Encrypted.Binary

    field :language, Ecto.Enum,
      values: Configuration.list_languages(:atom),
      default: Configuration.get_default_language(:atom)

    field :confirmed_at, :utc_datetime
    field :authenticated_at, :utc_datetime, virtual: true

    has_one :profile, UserProfile
    has_many :identities, UserIdentity
    has_many :teams, Member

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user changeset for adding or updating a user's settings.
  """
  def settings_changeset(user, attrs, opts \\ []) do
    user
    |> email_changeset(attrs, opts)
    |> cast(attrs, [:language, :tax_id])
    |> validate_required([:language])
  end

  @doc """
  A user changeset for signing up or changing the email.

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
