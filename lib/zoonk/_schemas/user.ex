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
  | `year_of_birth` | `Integer` | We need the year of birth for legal reasons when a profile is public. |
  | `currency` | `Ecto.Enum` | The currency used for payments. |
  | `kind` | `Ecto.Enum` | Users can have different types: `regular`, `agent`, `guest`, or `white_label`. |
  | `stripe_customer_id` | `String` | Customer ID used for Stripe payments. |
  | `tax_id` | `Zoonk.Encrypted.Binary` | Tax ID required by some jurisdictions. |
  | `language` | `Ecto.Enum` | The language used by the user. |
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
    field :stripe_customer_id, :string
    field :tax_id, Zoonk.Encrypted.Binary

    field :language, Ecto.Enum,
      values: Configuration.list_languages(:atom),
      default: Configuration.get_default_language(:atom)

    has_one :profile, UserProfile
    has_many :identities, UserIdentity
    has_many :teams, Member

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user changeset for adding or updating a user's settings.
  """
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:language, :tax_id])
    |> validate_required([:language])
  end
end
