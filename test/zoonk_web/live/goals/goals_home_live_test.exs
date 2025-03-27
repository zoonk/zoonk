defmodule ZoonkWeb.Goals.GoalsHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  describe "goals home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/goals")
      |> assert_path(~p"/login")
    end
  end

  describe "goals home page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> click_link("aside a", "Goals")
      |> assert_path(~p"/goals")
      |> assert_has("li[aria-current='page']", text: "Goals")
    end
  end
end
