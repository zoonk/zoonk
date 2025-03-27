defmodule Zoonk.Orgs.OrgProfileTest do
  use Zoonk.DataCase, async: true

  import Zoonk.OrgFixtures

  alias Zoonk.Orgs.OrgProfile
  alias Zoonk.ValidationData.SubdomainValidationData

  describe "subdomain validation" do
    test "allows valid subdomains" do
      for subdomain <- SubdomainValidationData.valid_subdomains() do
        attrs = valid_org_profile_attributes(%{subdomain: subdomain})
        changeset = OrgProfile.changeset(%OrgProfile{}, attrs)
        assert changeset.valid?
      end
    end

    test "rejects invalid subdomains" do
      for subdomain <- SubdomainValidationData.invalid_subdomains() do
        attrs = valid_org_profile_attributes(%{subdomain: subdomain})
        changeset = OrgProfile.changeset(%OrgProfile{}, attrs)
        refute changeset.valid?
        assert %{subdomain: ["can only contain letters, numbers, underscores, and hyphens"]} = errors_on(changeset)
      end
    end

    test "rejects subdomains with leading/trailing spaces despite trimming" do
      for subdomain <- SubdomainValidationData.space_subdomains() do
        changeset = OrgProfile.changeset(%OrgProfile{}, valid_org_profile_attributes(%{subdomain: subdomain}))
        refute changeset.valid?
        assert %{subdomain: ["can only contain letters, numbers, underscores, and hyphens"]} = errors_on(changeset)
      end
    end

    test "validates subdomain uniqueness" do
      # Create a profile with a specific subdomain
      existing_subdomain = "existing-subdomain"
      org_profile_fixture(%{subdomain: existing_subdomain})

      # Try to create another profile with the same subdomain
      {:error, changeset} =
        %OrgProfile{}
        |> OrgProfile.changeset(valid_org_profile_attributes(%{subdomain: existing_subdomain}))
        |> Repo.insert()

      assert %{subdomain: ["has already been taken"]} = errors_on(changeset)
    end

    test "validates subdomain length" do
      # Test empty
      changeset = OrgProfile.changeset(%OrgProfile{}, valid_org_profile_attributes(%{subdomain: ""}))
      assert %{subdomain: ["can't be blank"]} = errors_on(changeset)

      # Test too long
      long_subdomain = String.duplicate("a", 33)
      long_changeset = OrgProfile.changeset(%OrgProfile{}, valid_org_profile_attributes(%{subdomain: long_subdomain}))
      assert %{subdomain: ["should be at most 32 character(s)"]} = errors_on(long_changeset)
    end
  end
end
