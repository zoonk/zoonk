defmodule Zoonk.Repo.Migrations.CreateSpecializationUsers do
  use Ecto.Migration

  def change do
    create table(:specialization_users) do
      add :specialization_id, references(:specializations, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :role, :string, null: false, default: "member"

      timestamps(type: :utc_datetime_usec)
    end

    create index(:specialization_users, [:specialization_id])
    create index(:specialization_users, [:user_id])
    create unique_index(:specialization_users, [:specialization_id, :user_id])
  end
end
