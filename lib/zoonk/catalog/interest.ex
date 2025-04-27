defmodule Zoonk.Catalog.Interest do
  @moduledoc """
  Defines the `Interest` schema.

  Interests represent various user preferences across different categories.
  These interests are used to create personalized content for users.

  ## Fields

  | Field Name   | Type        | Description                              |
  |--------------|-------------|------------------------------------------|
  | `category`   | `Ecto.Enum` | The category of the interest (watch, read, use, etc). |
  | `slug`       | `String`    | Unique identifier for the interest.      |
  | `thumb_url`  | `String`    | URL for the interest thumbnail image.    |
  | `inserted_at`| `DateTime`  | Timestamp when the interest was created. |
  | `updated_at` | `DateTime`  | Timestamp when the interest was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.InterestTranslation
  alias Zoonk.Config.InterestConfig

  schema "interests" do
    field :category, Ecto.Enum, values: InterestConfig.list_categories(:atom), default: :other
    field :slug, :string
    field :thumb_url, :string

    has_many :translations, InterestTranslation

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(interest, attrs) do
    interest
    |> cast(attrs, [:category, :thumb_url, :slug])
    |> validate_required([:category, :slug])
    |> unique_constraint([:slug])
  end
end
