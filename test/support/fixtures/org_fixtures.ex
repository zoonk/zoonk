defmodule Zoonk.OrgFixtures do
  @moduledoc false

  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Orgs.OrgSettings
  alias Zoonk.Repo

  def valid_org_settings_attributes(attrs \\ %{}) do
    attrs
    |> Map.delete(:org)
    |> Enum.into(%{allowed_domains: []})
  end

  def valid_org_attributes(attrs \\ %{}) do
    unique_int = System.unique_integer([:positive])

    Enum.into(attrs, %{
      display_name: "Test Org #{unique_int}",
      custom_domain: "zoonk_#{unique_int}.test",
      subdomain: "org#{unique_int}",
      is_public: false
    })
  end

  def org_fixture(%{kind: :system}), do: system_org_fixture()

  def org_fixture(attrs) do
    attrs = valid_org_attributes(attrs)
    org_settings = valid_org_settings_attributes(Map.get(attrs, :settings, %{}))

    org =
      Repo.insert!(%Org{
        display_name: attrs.display_name,
        custom_domain: attrs.custom_domain,
        subdomain: attrs.subdomain,
        kind: :external,
        is_public: attrs.is_public
      })

    Repo.insert!(%OrgSettings{
      org_id: org.id,
      allowed_domains: org_settings.allowed_domains
    })

    org
  end

  def org_fixture, do: org_fixture(%{})

  @doc """
  Creates the system organization.

  We skip using changeset here because `:system` shouldn't be
  a valid value for `kind` in the changeset since only
  one organization can be the system organization.
  """
  def system_org_fixture do
    Org
    |> Repo.get_by(kind: :system)
    |> system_org_fixture()
  end

  # we can only have one system org, if it exists we return it
  defp system_org_fixture(%Org{} = org), do: org

  # otherwise we create a new one
  defp system_org_fixture(nil) do
    Repo.insert!(%Org{
      display_name: "Zoonk",
      custom_domain: "zoonk.test",
      subdomain: "zoonk",
      kind: :system,
      is_public: true
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
