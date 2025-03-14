defmodule ZoonkWeb.UserLive.LinkedAccountsTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "user linked accounts back navigation" do
    setup :signup_and_login_user

    test "goes to the previous page", %{conn: conn} do
      {:ok, goals_lv, _html} = live(conn, ~p"/goals")

      assert {:ok, email_lv, _html} =
               goals_lv
               |> element("a[href='/user/email?redirect_to=%2Fgoals']")
               |> render_click()
               |> follow_redirect(conn, ~p"/user/email?redirect_to=%2Fgoals")

      assert {:ok, linked_lv, _html} =
               email_lv
               |> element("a", "Linked Accounts")
               |> render_click()
               |> follow_redirect(conn, ~p"/user/linked?redirect_to=%2Fgoals")

      assert {:ok, back_lv, _html} =
               linked_lv
               |> element("a", "Back")
               |> render_click()
               |> follow_redirect(conn, ~p"/goals")

      assert has_element?(back_lv, "h1", "Goals")
      assert has_element?(back_lv, "li[aria-current='page']", "Goals")
    end
  end
end
