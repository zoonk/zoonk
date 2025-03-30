defmodule ZoonkWeb.OrgMemberRequiredHelper do
  @moduledoc false

  import ExUnit.Assertions
  import PhoenixTest
  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias ZoonkWeb.PermissionError

  @doc """
  Tests page authorization for different organization kinds and user states.

  This helper function tests multiple authorization scenarios:

  - Redirects to login when user is not authenticated
  - Allows access without membership for public organizations (:app, :creator)
  - Allows access for unconfirmed users in public organizations
  - Allows access for confirmed members in private organizations (:team, :school)
  - Raises error for unconfirmed members in private organizations
  - Raises error for non-members in private organizations

  ## Example

      assert_page_authorization(%{link: ~p"/", title: "Summary"})
  """
  def assert_page_authorization(page) do
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

  @doc """
  Tests admin page authorization for different organization kinds and admin roles.

  This helper function tests admin authorization scenarios:

  - Redirects to login when user is not authenticated
  - Allows access for users with admin role in the organization
  - Raises error for users with member role in the organization

  ## Example

      assert_admin_page_authorization(%{link: ~p"/editor", title: "Editor"})
  """
  def assert_admin_page_authorization(page) do
    redirects_to_login(:app, page)
    redirects_to_login(:creator, page)
    redirects_to_login(:team, page)
    redirects_to_login(:school, page)

    allow_access_for_org_admin(:app, page)
    allow_access_for_org_admin(:creator, page)
    allow_access_for_org_admin(:team, page)
    allow_access_for_org_admin(:school, page)

    raises_for_org_member(:app, page)
    raises_for_org_member(:creator, page)
    raises_for_org_member(:team, page)
    raises_for_org_member(:school, page)
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

  defp allow_access_for_org_admin(org_kind, page) do
    test_access(org_kind, page, confirmed?: true, create_member?: true, role: :admin, expect_success?: true)
  end

  defp raises_for_org_member(org_kind, page) do
    test_access(org_kind, page, confirmed?: true, create_member?: true, role: :member, expect_success?: false)
  end

  defp test_access(org_kind, page, opts) do
    user = if opts[:confirmed?], do: user_fixture(), else: unconfirmed_user_fixture()
    org = org_fixture(%{kind: org_kind})

    if opts[:create_member?] do
      role = Keyword.get(opts, :role, :member)
      org_member_fixture(%{user: user, org: org, role: role})
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
