defmodule Zoonk.OrgFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Zoonk.Orgs` context.
  """

  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Orgs.OrgSettings
  alias Zoonk.Repo

  def valid_org_settings_attributes(attrs \\ %{}) do
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)

    attrs
    |> Map.delete(:org)
    |> Enum.into(%{currency: :USD, org_id: org.id})
  end

  def valid_org_attributes(attrs \\ %{}) do
    unique_int = System.unique_integer([:positive])
    Enum.into(attrs, %{display_name: "Test Org #{unique_int}", subdomain: "org#{unique_int}"})
  end

  @doc """
  Creates an organization.

  ## Examples

      iex> org_fixture()
      %Org{kind: :team}

      iex> org_fixture(%{kind: :school})
      %Org{kind: :school}
  """
  def org_fixture(attrs \\ %{}) do
    {:ok, org} =
      %Org{}
      |> Org.changeset(valid_org_attributes(attrs))
      |> Repo.insert()

    org
  end

  @doc """
  Creates the main app organization.

  We skip using changeset here because `:app` shouldn't be
  a valid value for `kind` in the changeset since only
  one organization can be the app organization.
  """
  def app_org_fixture do
    Repo.insert!(%Org{
      display_name: "App Org",
      custom_domain: "zoonk-#{System.unique_integer()}.test",
      subdomain: "zoonk_dev",
      kind: :app
    })
  end

  @doc """
  Creates an organization settings.

  ## Examples

      iex> org_settings_fixture()
      %OrgSettings{}

      iex> org_settings_fixture(%{subdomain: "mysubdomain"})
      %OrgSettings{subdomain: "mysubdomain"}
  """
  def org_settings_fixture(attrs \\ %{}) do
    {:ok, settings} =
      %OrgSettings{}
      |> OrgSettings.changeset(valid_org_settings_attributes(attrs))
      |> Repo.insert()

    settings
  end

  @doc """
  Creates an organization member.

  ## Examples

      iex> org_member_fixture(%{org: %Org{}, user: %User{}})
      %OrgMember{}

      iex> org_member_fixture(%{role: :admin})
      %OrgMember{role: :admin}
  """
  def org_member_fixture(attrs \\ %{}) do
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)
    user = Map.get_lazy(attrs, :user, fn -> Zoonk.AccountFixtures.user_fixture() end)

    attrs = Enum.into(attrs, %{org_id: org.id, user_id: user.id, role: :member})

    %OrgMember{}
    |> OrgMember.changeset(attrs)
    |> Repo.insert!()
  end
end
