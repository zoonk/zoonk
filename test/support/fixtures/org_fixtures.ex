defmodule Zoonk.OrgFixtures do
  @moduledoc false
  alias Zoonk.Orgs
  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Orgs.OrgSettings
  alias Zoonk.Repo

  def valid_org_settings_attributes(attrs \\ %{}) do
    attrs
    |> Map.delete(:org)
    |> Enum.into(%{currency: "USD"})
  end

  def valid_org_attributes(attrs \\ %{}) do
    unique_int = System.unique_integer([:positive])

    Enum.into(attrs, %{
      display_name: "Test Org #{unique_int}",
      custom_domain: "zoonk_#{unique_int}.test",
      subdomain: "org#{unique_int}"
    })
  end

  def org_fixture(%{kind: :app}), do: app_org_fixture()

  def org_fixture(attrs) do
    {:ok, org} =
      attrs
      |> Map.get(:kind, :team)
      |> Orgs.create_org(valid_org_attributes(attrs))

    maybe_update_settings(Map.get(attrs, :settings, nil), org)
    org
  end

  def org_fixture, do: org_fixture(%{})

  defp maybe_update_settings(nil, _org), do: nil

  defp maybe_update_settings(settings, org) do
    OrgSettings
    |> Repo.get_by!(org_id: org.id)
    |> OrgSettings.changeset(settings)
    |> Repo.update!()
  end

  @doc """
  Creates the main app organization.

  We skip using changeset here because `:app` shouldn't be
  a valid value for `kind` in the changeset since only
  one organization can be the app organization.
  """
  def app_org_fixture do
    Org
    |> Repo.get_by(kind: :app)
    |> app_org_fixture()
  end

  # we can only have one app org, if it exists we return it
  defp app_org_fixture(%Org{} = org), do: org

  # otherwise we create a new one
  defp app_org_fixture(nil) do
    Repo.insert!(%Org{
      display_name: "App Org",
      custom_domain: "zoonk.test",
      subdomain: "zk_test",
      kind: :app
    })
  end

  def org_settings_fixture(attrs \\ %{}) do
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)

    {:ok, settings} =
      %OrgSettings{org: org.id}
      |> OrgSettings.changeset(valid_org_settings_attributes(attrs))
      |> Repo.insert()

    settings
  end

  def org_member_fixture(%{user: nil}), do: nil

  def org_member_fixture(attrs) do
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)
    user = Map.get_lazy(attrs, :user, fn -> Zoonk.AccountFixtures.user_fixture() end)

    attrs = Enum.into(attrs, %{role: :member})

    %OrgMember{org_id: org.id, user_id: user.id}
    |> OrgMember.changeset(attrs)
    |> Repo.insert!(on_conflict: :replace_all, conflict_target: [:user_id, :org_id])
  end
end
