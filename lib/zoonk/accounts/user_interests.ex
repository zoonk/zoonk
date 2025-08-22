defmodule Zoonk.Accounts.UserInterests do
  @moduledoc """
  Defines the `UserInterests` schema for storing user learning preferences and interests.

  This schema contains information about what users are interested in, their learning
  struggles, work background, and location to help provide personalized learning
  experiences with relevant examples and exercises.

  ## Fields

  | Field Name          | Type           | Description                                              |
  |---------------------|----------------|----------------------------------------------------------|
  | `struggles`         | `String`       | Areas where the user faces challenges                    |
  | `work_field`        | `String`       | User's profession or field of work                       |
  | `location`          | `String`       | User's general location (city, country)                  |
  | `media`             | `String`       | Favorite books, movies, TV shows, games, etc.            |
  | `hobbies`           | `String`       | User's hobbies and recreational activities               |
  | `examples`          | `String`       | Types of examples the user prefers in lessons            |
  | `user_id`           | `Integer`      | The ID from `Zoonk.Accounts.User`.                       |
  | `inserted_at`       | `DateTime`     | Timestamp when the interests were created.               |
  | `updated_at`        | `DateTime`     | Timestamp when the interests were last updated.          |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User

  schema "user_interests" do
    field :examples, :string
    field :hobbies, :string
    field :location, :string
    field :media, :string
    field :struggles, :string
    field :work_field, :string

    belongs_to :user, User

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(user_interests, attrs) do
    user_interests
    |> cast(attrs, [:examples, :hobbies, :location, :media, :struggles, :work_field])
    |> update_change(:examples, &String.trim/1)
    |> update_change(:hobbies, &String.trim/1)
    |> update_change(:location, &String.trim/1)
    |> update_change(:media, &String.trim/1)
    |> update_change(:struggles, &String.trim/1)
    |> update_change(:work_field, &String.trim/1)
  end
end
