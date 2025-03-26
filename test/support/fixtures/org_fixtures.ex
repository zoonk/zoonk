defmodule Zoonk.OrgFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Zoonk.Orgs` context.
  """

  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgProfile
  alias Zoonk.Repo

  @doc """
  Creates an organization.

  ## Examples

      iex> org_fixture()
      %Org{}

      iex> org_fixture(%{kind: :school})
      %Org{kind: :school}
  """
  def org_fixture(attrs \\ %{}) do
    attrs =
      Enum.into(attrs, %{
        kind: :team,
        currency: :USD
      })

    {:ok, org} =
      %Org{}
      |> Org.changeset(attrs)
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
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)
    unique_int = System.unique_integer([:positive])

    profile_attrs =
      attrs
      |> Map.delete(:org)
      |> Enum.into(%{
        display_name: "Test Org #{unique_int}",
        subdomain: "org#{unique_int}",
        org_id: org.id
      })

    {:ok, profile} =
      %OrgProfile{}
      |> OrgProfile.changeset(profile_attrs)
      |> Repo.insert()

    profile
  end

  @doc """
  Creates an organization profile with a custom domain.

  ## Examples

      iex> org_profile_with_custom_domain_fixture()
      %OrgProfile{custom_domain: "custom-domain-123.com"}
  """
  def org_profile_with_custom_domain_fixture(attrs \\ %{}) do
    attrs =
      Map.put_new_lazy(attrs, :custom_domain, fn ->
        "custom-domain-#{System.unique_integer([:positive])}.com"
      end)

    org_profile_fixture(attrs)
  end
end
