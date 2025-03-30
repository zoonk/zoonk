defmodule ZoonkWeb.OrgMemberRequiredHelper do
  @moduledoc false

  import ExUnit.Assertions
  import PhoenixTest
  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias ZoonkWeb.PermissionError

  def assert_require_org_member(page) do
    redirects_to_login(:app, page)
    redirects_to_login(:creator, page)
    redirects_to_login(:team, page)
    redirects_to_login(:school, page)

    allow_access_without_membership(:app, page)
    allow_access_without_membership(:creator, page)

    allow_access_for_unconfirmed_user(:app, page)
    allow_access_for_unconfirmed_user(:creator, page)

    allow_access_for_confirmed_member(:team, page)
    allow_access_for_confirmed_member(:school, page)

    raises_for_unconfirmed_member(:team, page)
    raises_for_unconfirmed_member(:school, page)

    raises_without_membership(:team, page)
    raises_without_membership(:school, page)
  end

  defp allow_access_without_membership(org_kind, page) do
    test_access(org_kind, page, confirmed?: true, create_member?: false, expect_success?: true)
  end

  defp allow_access_for_unconfirmed_user(org_kind, page) do
    test_access(org_kind, page, confirmed?: false, create_member?: true, expect_success?: true)
  end

  defp allow_access_for_confirmed_member(org_kind, page) do
    test_access(org_kind, page, confirmed?: true, create_member?: true, expect_success?: true)
  end

  defp raises_for_unconfirmed_member(org_kind, page) do
    test_access(org_kind, page, confirmed?: false, create_member?: true, expect_success?: false)
  end

  defp raises_without_membership(org_kind, page) do
    test_access(org_kind, page, confirmed?: true, create_member?: false, expect_success?: false)
  end

  defp test_access(org_kind, page, opts) do
    user = if opts[:confirmed?], do: user_fixture(), else: unconfirmed_user_fixture()
    org = org_fixture(%{kind: org_kind})

    if opts[:create_member?] do
      org_member_fixture(%{user: user, org: org})
    end

    conn =
      Phoenix.ConnTest.build_conn()
      |> Map.put(:host, org.custom_domain)
      |> ZoonkWeb.ConnCase.login_user(user)

    if opts[:expect_success?] do
      conn
      |> visit(page.link)
      |> assert_has("li[aria-current='page']", text: page.title)
    else
      assert_raise(PermissionError, fn -> visit(conn, page.link) end)
    end
  end

  defp redirects_to_login(org_kind, page) do
    conn = Phoenix.ConnTest.build_conn()
    org = org_fixture(%{kind: org_kind})

    conn
    |> Map.put(:host, org.custom_domain)
    |> visit(page.link)
    |> assert_path("/login")
  end
end
