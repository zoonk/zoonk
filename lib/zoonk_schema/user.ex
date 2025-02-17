defmodule ZoonkSchema.User do
  @moduledoc """
  Defines the `User` schema and related changesets.

  This schema represents users in the system, storing their
  email and account confirmation status. It also includes
  changeset functions for managing user registration,
  email validation, and account confirmation.

  ## Fields

    * `email` - The user's email address.
    * `language` - The user's preferred language.
    * `confirmed_at` - The timestamp when the account was confirmed.
    * `authenticated_at` (virtual) - The last authentication timestamp, used temporarily.

  ## Changesets

    * `email_changeset/3` - Validates and updates the email
    field, ensuring it is unique and correctly formatted.
    * `confirm_changeset/1` - Marks the account as confirmed
    by setting `confirmed_at`.
  """
  use Ecto.Schema

  import Ecto.Changeset

  schema "users" do
    field :email, :string
    field :language, Ecto.Enum, values: [:de, :en, :es, :fr, :it, :ja, :ko, :pt, :tr, :zh_Hans, :zh_Hant], default: :en
    field :confirmed_at, :utc_datetime
    field :authenticated_at, :utc_datetime, virtual: true

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
