defmodule Zoonk.Repo.Migrations.AddContentReactionsTable do
  use Ecto.Migration

  def change do
    create table(:content_reactions) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :content_id, references(:contents, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :reaction, :string, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:content_reactions, [:org_id, :content_id, :user_id])

    create index(:content_reactions, [:org_id, :reaction, :inserted_at])
    create index(:content_reactions, [:org_id, :content_id, :reaction, :inserted_at])
  end
end
