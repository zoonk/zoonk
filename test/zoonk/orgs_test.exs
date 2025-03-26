defmodule Zoonk.OrgsTest do
  use Zoonk.DataCase, async: true

  import Zoonk.OrgFixtures

  alias Zoonk.Orgs

  describe "get_profile_by_host/1" do
    test "returns org profile when host matches custom_domain exactly" do
      profile = org_profile_with_custom_domain_fixture()
      assert Orgs.get_profile_by_host(profile.custom_domain) == profile
    end

    test "returns org profile when host contains subdomain that matches" do
      profile = org_profile_fixture()
      assert Orgs.get_profile_by_host("#{profile.subdomain}.zoonk.com") == profile
    end

    test "returns org profile when host has multiple subdomains but first part matches" do
      profile = org_profile_fixture()
      assert Orgs.get_profile_by_host("#{profile.subdomain}.something.zoonk.com") == profile
    end

    test "returns nil when no org profile with matching custom_domain or subdomain exists" do
      assert Orgs.get_profile_by_host("nonexistent.zoonk.com") == nil
    end

    test "returns nil when host is nil" do
      assert Orgs.get_profile_by_host(nil) == nil
    end

    test "returns nil when host is empty string" do
      assert Orgs.get_profile_by_host("") == nil
    end

    test "returns nil when host has no subdomain part" do
      assert Orgs.get_profile_by_host("zoonk.com") == nil
    end

    test "returns org profile with custom domain when both custom domain and subdomain would match" do
      # Create a profile with a specific custom domain
      custom_domain = "custom-domain-test.com"
      profile = org_profile_with_custom_domain_fixture(%{custom_domain: custom_domain})

      # Create another org profile with a subdomain matching the first part of the custom domain
      org_profile_fixture(%{subdomain: "custom"})

      # Should match the custom domain exactly rather than extracting subdomain
      assert Orgs.get_profile_by_host(custom_domain) == profile
    end

    test "returns nil for malformed host" do
      assert Orgs.get_profile_by_host("malformed") == nil
    end

    test "case-insensitive matching for custom domains" do
      profile = org_profile_with_custom_domain_fixture(%{custom_domain: "my-domain.com"})

      # Should match regardless of case
      assert Orgs.get_profile_by_host("MY-DOMAIN.COM") == profile
      assert Orgs.get_profile_by_host("my-domain.com") == profile
      assert Orgs.get_profile_by_host("My-Domain.Com") == profile
    end

    test "case-insensitive matching for subdomains" do
      profile = org_profile_fixture(%{subdomain: "mysubdomain"})

      # Should match regardless of case
      assert Orgs.get_profile_by_host("MYSUBDOMAIN.zoonk.com") == profile
      assert Orgs.get_profile_by_host("mysubdomain.zoonk.com") == profile
      assert Orgs.get_profile_by_host("MySubdomain.zoonk.com") == profile
    end

    test "subdomain containing only alphanumeric characters is handled properly" do
      profile = org_profile_fixture(%{subdomain: "alphanumeric123"})
      assert Orgs.get_profile_by_host("alphanumeric123.zoonk.com") == profile
    end
  end
end
