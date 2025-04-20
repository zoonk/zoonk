defmodule Zoonk.Catalog.Specialization do
  @moduledoc """
  Defines the `Specialization` schema.

  Specializations group related courses together.
  They allow users to go deeper on a specific topic.

  Each specialization belongs to an organization
  and can have multiple translations for different languages.

  ## Fields

  | Field Name              | Type         | Description                                                  |
  |-------------------------|--------------|--------------------------------------------------------------|
  | `org_id`                | `Integer`    | The ID of the organization that owns this specialization.    |
  | `categories`            | `List`       | List of categories the specialization belongs to.            |
  | `thumb_url`             | `String`     | URL for the specialization thumbnail image.                  |
  | `translations`          | `List`       | List of translations for the specialization.                 |
  | `specialization_users`  | `List`       | List of users associated with the specialization.            |
  | `specialization_courses`| `List`       | List of courses included in the specialization.              |
  | `inserted_at`           | `DateTime`   | Timestamp when the specialization was created.               |
  | `updated_at`            | `DateTime`   | Timestamp when the specialization was last updated.          |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.SpecializationCourse
  alias Zoonk.Catalog.SpecializationTranslation
  alias Zoonk.Catalog.SpecializationUser
  alias Zoonk.Config.CategoryConfig
  alias Zoonk.Orgs.Org

  schema "specializations" do
    field :categories, {:array, Ecto.Enum}, values: CategoryConfig.list_categories(:atom), default: []
    field :thumb_url, :string

    belongs_to :org, Org

    has_many :translations, SpecializationTranslation
    has_many :specialization_users, SpecializationUser
    has_many :specialization_courses, SpecializationCourse

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(specialization, attrs) do
    specialization
    |> cast(attrs, [:org_id, :categories, :thumb_url])
    |> validate_required([:org_id, :categories])
  end
end
