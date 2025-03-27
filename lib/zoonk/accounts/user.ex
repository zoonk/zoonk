defmodule Zoonk.Accounts.User do
  @moduledoc """
  Defines the `User` schema.

  This schema represents users in the system, storing their
  email and account confirmation status. It also includes
  changeset functions for managing user signup,
  email validation, and account confirmation.

  For public information, we use the `Zoonk.Accounts.UserProfile` schema instead.

  ## User Types

  | Type | Description |
  |------|-------------|
  | `:regular` | Regular users. |
  | `:agent` | AI bots and agents. |
  | `:guest` | Users who didn't create an account. |

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `year_of_birth` | `Integer` | We need the year of birth for legal reasons when a profile is public. |
  | `currency` | `Ecto.Enum` | The currency used for payments. |
  | `kind` | `Ecto.Enum` | Users can have different types: `regular`, `agent`, `guest`. |
  | `email` | `String` | The user's email address. |
  | `stripe_customer_id` | `String` | Customer ID used for Stripe payments. |
  | `tax_id` | `Zoonk.Vault.Binary` | Tax ID required by some jurisdictions. |
  | `language` | `Ecto.Enum` | The language used by the user. |
  | `confirmed_at` | `DateTime` | Timestamp when the account was confirmed. |
  | `authenticated_at` | `DateTime` | Timestamp when the user was last authenticated. |
  | `profile` | `Zoonk.Accounts.UserProfile` | The user's public profile. |
  | `providers` | `Zoonk.Accounts.UserProvider` | The user's OAuth providers. |
  | `inserted_at` | `DateTime` | Timestamp when the user was created. |
  | `updated_at` | `DateTime` | Timestamp when the user was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.UserProfile
  alias Zoonk.Accounts.UserProvider
  alias Zoonk.Config.CurrencyConfig
  alias Zoonk.Config.LanguageConfig

  schema "users" do
    field :year_of_birth, :integer
    field :currency, Ecto.Enum, values: CurrencyConfig.list_currencies(:atom), default: :USD
    field :kind, Ecto.Enum, values: [:regular, :agent, :guest], default: :regular
    field :email, :string
    field :stripe_customer_id, :string
    field :tax_id, Zoonk.Vault.Binary

    field :language, Ecto.Enum,
      values: LanguageConfig.list_languages(:atom),
      default: LanguageConfig.get_default_language(:atom)

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

  @doc """
  Get a user's name.

  Useful for displaying the user's name.
  It handles the case where the user has not set a display name
  and falls back to the username.
  """
  def get_display_name(%UserProfile{display_name: nil} = profile), do: profile.username
  def get_display_name(%UserProfile{display_name: display_name}), do: display_name
end
