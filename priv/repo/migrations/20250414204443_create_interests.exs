defmodule Zoonk.Repo.Migrations.CreateInterests do
  use Ecto.Migration

  def change do
    create table(:interests) do
      add :category, :string, null: false
      add :slug, :citext, null: false
      add :thumb_url, :string

      timestamps(type: :utc_datetime_usec)
    end

    create index(:interests, [:category])
    create unique_index(:interests, [:slug])
  end
end
