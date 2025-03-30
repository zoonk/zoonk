defmodule ZoonkWeb.OrgMemberRequiredHelper do
  @moduledoc false

  import ExUnit.Assertions
  import PhoenixTest
  import Plug.Conn
  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Scope
  alias ZoonkWeb.PermissionError

  def assert_unconfirmed_member_access_denied(conn, org, page) do
    user = %{user_fixture() | confirmed_at: nil}
    org_member = org_member_fixture(%{user: user, org: org})
    scope = %Scope{user: user, org: org, org_member: org_member}

    assert_raise(PermissionError, fn ->
      conn
      |> assign(:current_scope, scope)
      |> visit(page)
    end)
  end
end
