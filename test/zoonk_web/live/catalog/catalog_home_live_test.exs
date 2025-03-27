defmodule ZoonkWeb.Catalog.CatalogHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "catalog home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/catalog")
      |> assert_path(~p"/login")
    end
  end

  describe "catalog home page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      conn
      |> visit(~p"/catalog")
      |> click_link("aside a", "Catalog")
      |> assert_path(~p"/catalog")
      |> assert_has("li[aria-current='page']", text: "Catalog")
    end
  end
end
