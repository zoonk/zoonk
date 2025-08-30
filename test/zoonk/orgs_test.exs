defmodule Zoonk.OrgsTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Accounts.Subdomain
  alias Zoonk.Orgs
  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember

  describe "change_org/2" do
    test "allows valid subdomains" do
      valid = ["myorg", "my-org", "my_org", "myorg123", "123myorg", "my-org-123", "my_org_123", "MY-ORG"]

      for subdomain <- valid do
        attrs = valid_org_attributes(%{subdomain: subdomain})
        assert %Ecto.Changeset{valid?: true} = Org.changeset(%Org{}, attrs)
      end
    end

    test "rejects subdomains with special characters" do
      invalid = ["my.org", "my@org", "my/org", "my\\org", "my:org", "my;org", "my,org", "my org"]

      for subdomain <- invalid do
        attrs = valid_org_attributes(%{subdomain: subdomain})
        assert %Ecto.Changeset{valid?: false} = changeset = Org.changeset(%Org{}, attrs)
        assert %{subdomain: ["cannot have spaces for special characters"]} = errors_on(changeset)
      end
    end

    test "rejects subdomains without letters" do
      invalid = ["123", "12_", "1--", "--", "__"]

      for subdomain <- invalid do
        attrs = valid_org_attributes(%{subdomain: subdomain})
        assert %Ecto.Changeset{valid?: false} = changeset = Org.changeset(%Org{}, attrs)
        assert %{subdomain: ["must have letters"]} = errors_on(changeset)
      end
    end

    test "rejects reserved subdomains" do
      reserved = Enum.take_random(Subdomain.list_reserved_subdomains(), 10)

      for subdomain <- reserved do
        attrs = valid_org_attributes(%{subdomain: subdomain})
        assert %Ecto.Changeset{valid?: false} = changeset = Org.changeset(%Org{}, attrs)
        assert "is reserved" in errors_on(changeset).subdomain
      end
    end
  end

  describe "create_org/1" do
    test "creates an organization with valid data" do
      attrs = valid_org_attributes()

      assert {:ok, %Org{} = org} = Orgs.create_org(attrs)
      assert org.display_name == attrs.display_name
      assert org.subdomain == attrs.subdomain
      assert org.kind == :external
    end

    test "creates an organization with all optional fields" do
      valid_attrs = %{
        display_name: "Complete Organization",
        subdomain: "complete-org",
        # Don't allow to override kind
        kind: :system,
        bio: "Organization description",
        public_email: "info@example.com",
        icon_url: "https://example.com/icon.png",
        logo_url: "https://example.com/logo.png",
        custom_domain: "example-org.com"
      }

      assert {:ok, %Org{} = org} = Orgs.create_org(valid_attrs)
      assert org.display_name == "Complete Organization"
      assert org.subdomain == "complete-org"
      assert org.kind == :external
      assert org.bio == "Organization description"
      assert org.public_email == "info@example.com"
      assert org.icon_url == "https://example.com/icon.png"
      assert org.logo_url == "https://example.com/logo.png"
      assert org.custom_domain == "example-org.com"
    end

    test "returns error changeset when display_name length is invalid" do
      # Too short (empty)
      short_attrs = valid_org_attributes(%{display_name: ""})
      assert {:error, changeset} = Orgs.create_org(short_attrs)
      assert %{display_name: ["can't be blank"]} = errors_on(changeset)

      # Too long (more than 32 chars)
      long_attrs = valid_org_attributes(%{display_name: String.duplicate("a", 33)})
      assert {:error, changeset} = Orgs.create_org(long_attrs)
      assert %{display_name: ["should be at most 32 character(s)"]} = errors_on(changeset)
    end

    test "returns error changeset when subdomain length is invalid" do
      # Too short (empty)
      assert {:error, changeset} = Orgs.create_org(%{display_name: "Test Org", subdomain: ""})
      assert %{subdomain: ["can't be blank"]} = errors_on(changeset)

      # Too long (more than 32 chars)
      assert {:error, changeset} = Orgs.create_org(%{display_name: "Test Org", subdomain: String.duplicate("a", 33)})
      assert %{subdomain: ["should be at most 32 character(s)"]} = errors_on(changeset)
    end

    test "returns error changeset when subdomain is already taken" do
      # Create an org first
      existing = valid_org_attributes()
      assert {:ok, %Org{}} = Orgs.create_org(existing)

      # Try to create another org with the same subdomain
      attrs = %{display_name: "Another Org", subdomain: existing.subdomain}
      assert {:error, changeset} = Orgs.create_org(attrs)
      assert %{subdomain: ["has already been taken"]} = errors_on(changeset)
    end

    test "returns error changeset when custom_domain is already taken" do
      # Create an org first with a custom domain
      custom_domain = "example-#{System.unique_integer([:positive])}.com"
      attrs1 = %{display_name: "First Org", subdomain: "first-org", custom_domain: custom_domain}
      assert {:ok, %Org{}} = Orgs.create_org(attrs1)

      # Try to create another org with the same custom domain
      attrs2 = %{display_name: "Second Org", subdomain: "second-org", custom_domain: custom_domain}
      assert {:error, changeset} = Orgs.create_org(attrs2)
      assert %{custom_domain: ["has already been taken"]} = errors_on(changeset)
    end

    test "returns a ConstraintError when trying to create a second org with kind = :system" do
      system_org_fixture()

      assert_raise Ecto.ConstraintError, fn ->
        Zoonk.Repo.insert!(%Org{
          display_name: "Zoonk",
          subdomain: "sub_#{System.unique_integer([:positive])}",
          kind: :system
        })
      end
    end

    test "adds default settings when creating an org" do
      attrs = valid_org_attributes()
      assert {:ok, %Org{} = org} = Orgs.create_org(attrs)
      scope = scope_fixture(%{org: org, role: :admin})
      assert Orgs.get_org_settings(scope).org_id == org.id
    end
  end

  describe "get_org_by_host/1" do
    test "returns org when host matches custom_domain exactly" do
      custom_domain = "custom-domain-#{System.unique_integer()}.com"
      org = org_fixture(%{custom_domain: custom_domain})
      assert Orgs.get_org_by_host(custom_domain) == org
    end

    test "returns org when host contains subdomain that matches" do
      org = org_fixture()
      assert Orgs.get_org_by_host("#{org.subdomain}.zoonk.com") == org
    end

    test "returns org when host has multiple subdomains but first part matches" do
      org = org_fixture()
      assert Orgs.get_org_by_host("#{org.subdomain}.something.zoonk.com") == org
    end

    test "returns nil when no org with matching custom_domain or subdomain exists" do
      assert Orgs.get_org_by_host("nonexistent.zoonk.com") == nil
    end

    test "returns the system org when host is nil" do
      system_org = system_org_fixture()
      assert Orgs.get_org_by_host(nil) == system_org
    end

    test "returns the system org when host is empty string" do
      system_org = system_org_fixture()
      assert Orgs.get_org_by_host("") == system_org
    end

    test "returns nil when host has no subdomain part" do
      assert Orgs.get_org_by_host("zoonk.com") == nil
    end

    test "returns org with custom domain when both custom domain and subdomain would match" do
      # Create an org with a specific custom domain
      custom_domain = "custom-domain-#{System.unique_integer()}.com"
      org = org_fixture(%{custom_domain: custom_domain})

      # Create another org with a subdomain matching the first part of the custom domain
      org_fixture(%{subdomain: "custom"})

      # Should match the custom domain exactly rather than extracting subdomain
      assert Orgs.get_org_by_host(custom_domain) == org
    end

    test "returns nil for malformed host" do
      assert Orgs.get_org_by_host("malformed") == nil
    end

    test "case-insensitive matching for custom domains" do
      org = org_fixture(%{custom_domain: "my-domain.com"})

      # Should match regardless of case
      assert Orgs.get_org_by_host("MY-DOMAIN.COM") == org
      assert Orgs.get_org_by_host("my-domain.com") == org
      assert Orgs.get_org_by_host("My-Domain.Com") == org
    end

    test "case-insensitive matching for subdomains" do
      org = org_fixture(%{subdomain: "mysubdomain"})

      # Should match regardless of case
      assert Orgs.get_org_by_host("MYSUBDOMAIN.zoonk.com") == org
      assert Orgs.get_org_by_host("mysubdomain.zoonk.com") == org
      assert Orgs.get_org_by_host("MySubdomain.zoonk.com") == org
    end

    test "subdomain containing only alphanumeric characters is handled properly" do
      org = org_fixture(%{subdomain: "alphanumeric123"})
      assert Orgs.get_org_by_host("alphanumeric123.zoonk.com") == org
    end

    test "returns the system org if there's no match for either custom_domain or subdomain" do
      system_org = system_org_fixture()

      # Create another org with a different subdomain and custom domain
      org_fixture(%{subdomain: "other-org", custom_domain: "other-org.com"})

      # Should return the main org
      assert Orgs.get_org_by_host("main-org.zoonk.com") == system_org
    end
  end

  describe "get_org_member/2" do
    test "returns org member when user_id and org_id match" do
      user = user_fixture()
      org = org_fixture()
      org_member = org_member_fixture(%{user: user, org: org})

      assert Orgs.get_org_member(org, user) == org_member
    end

    test "returns nil when user_id and org_id do not match" do
      user1 = user_fixture()
      user2 = user_fixture()
      org = org_fixture()
      org_member_fixture(%{user: user1, org: org})

      refute Orgs.get_org_member(org, user2)
    end

    test "returns nil when no matching org member exists" do
      user = user_fixture()
      refute Orgs.get_org_member(-1, user)
    end
  end

  describe "get_org_settings/1" do
    test "returns org settings for admins" do
      scope = scope_fixture(%{kind: :external, role: :admin})
      settings = Orgs.get_org_settings(scope)
      assert settings.org_id == scope.org.id
    end

    test "returns nil for non-admins" do
      scope = scope_fixture(%{kind: :external, role: :member})
      refute Orgs.get_org_settings(scope)
    end
  end

  describe "create_org_member/3" do
    test "creates org member when user is admin" do
      scope = scope_fixture(%{kind: :external, role: :admin})
      user = user_fixture()

      assert {:ok, %OrgMember{} = org_member} = Orgs.create_org_member(scope, user, %{role: :member})

      assert org_member.org_id == scope.org.id
      assert org_member.user_id == user.id
      assert org_member.role == :member
    end

    test "allows admin to create other admins" do
      scope = scope_fixture(%{kind: :external, role: :admin})
      user = user_fixture()

      assert {:ok, %OrgMember{} = org_member} = Orgs.create_org_member(scope, user, %{role: :admin})

      assert org_member.org_id == scope.org.id
      assert org_member.user_id == user.id
      assert org_member.role == :admin
    end

    test "returns error when user is not admin" do
      scope = scope_fixture(%{kind: :external, role: :member})
      user = user_fixture()
      assert Orgs.create_org_member(scope, user, %{role: :member}) == {:error, :unauthorized}
    end
  end
end
