defmodule Zoonk.OrgFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Zoonk.Orgs` context.
  """

  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgProfile
  alias Zoonk.Repo

  def valid_org_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      kind: :team,
      currency: :USD
    })
  end

  def valid_org_profile_attributes(attrs \\ %{}) do
    unique_int = System.unique_integer([:positive])
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)

    attrs
    |> Map.delete(:org)
    |> Enum.into(%{
      display_name: "Test Org #{unique_int}",
      subdomain: "org#{unique_int}",
      org_id: org.id
    })
  end

  @doc """
  Creates an organization.

  ## Examples

      iex> org_fixture()
      %Org{}

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
  Creates an organization profile.

  ## Examples

      iex> org_profile_fixture()
      %OrgProfile{}

      iex> org_profile_fixture(%{subdomain: "mysubdomain"})
      %OrgProfile{subdomain: "mysubdomain"}
  """
  def org_profile_fixture(attrs \\ %{}) do
    {:ok, profile} =
      %OrgProfile{}
      |> OrgProfile.changeset(valid_org_profile_attributes(attrs))
      |> Repo.insert()

    profile
  end
end
