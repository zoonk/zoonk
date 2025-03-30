defmodule ZoonkWeb.OrgMemberRequiredHelper do
  @moduledoc false

  import ExUnit.Assertions
  import PhoenixTest
  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias ZoonkWeb.PermissionError

  def assert_require_org_member(page) do
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
    conn = Phoenix.ConnTest.build_conn()
    user = user_fixture()
    org = org_fixture(%{kind: org_kind})

    conn
    |> Map.put(:host, org.custom_domain)
    |> ZoonkWeb.ConnCase.login_user(user)
    |> visit(page.link)
    |> assert_has("li[aria-current='page']", text: page.title)
  end

  defp allow_access_for_unconfirmed_user(org_kind, page) do
    conn = Phoenix.ConnTest.build_conn()
    user = unconfirmed_user_fixture()
    org = org_fixture(%{kind: org_kind})
    org_member_fixture(%{user: user, org: org})

    conn
    |> Map.put(:host, org.custom_domain)
    |> ZoonkWeb.ConnCase.login_user(user)
    |> visit(page.link)
    |> assert_has("li[aria-current='page']", text: page.title)
  end

  defp allow_access_for_confirmed_member(org_kind, page) do
    conn = Phoenix.ConnTest.build_conn()
    user = user_fixture()
    org = org_fixture(%{kind: org_kind})
    org_member_fixture(%{user: user, org: org})

    conn
    |> Map.put(:host, org.custom_domain)
    |> ZoonkWeb.ConnCase.login_user(user)
    |> visit(page.link)
    |> assert_has("li[aria-current='page']", text: page.title)
  end

  defp raises_for_unconfirmed_member(org_kind, page) do
    conn = Phoenix.ConnTest.build_conn()
    user = unconfirmed_user_fixture()
    org = org_fixture(%{kind: org_kind})
    org_member_fixture(%{user: user, org: org})

    assert_raise(PermissionError, fn ->
      conn
      |> Map.put(:host, org.custom_domain)
      |> ZoonkWeb.ConnCase.login_user(user)
      |> visit(page.link)
    end)
  end

  defp raises_without_membership(org_kind, page) do
    conn = Phoenix.ConnTest.build_conn()
    user = user_fixture()
    org = org_fixture(%{kind: org_kind})

    assert_raise(PermissionError, fn ->
      conn
      |> Map.put(:host, org.custom_domain)
      |> ZoonkWeb.ConnCase.login_user(user)
      |> visit(page.link)
    end)
  end
end
