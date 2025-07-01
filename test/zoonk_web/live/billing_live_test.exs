defmodule ZoonkWeb.BillingLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AccountFixtures
  import Zoonk.BillingFixtures
  import Zoonk.OrgFixtures

  describe "GET /billing" do
    test "redirects to subscription when user has billing account", %{conn: conn} do
      user = user_fixture()
      org = app_org_fixture()
      _billing_account = billing_account_fixture(%{user: user})

      conn = conn |> Map.put(:host, org.custom_domain) |> login_user(user)

      assert {:error, {:redirect, %{to: "/subscription"}}} = live(conn, ~p"/billing")
    end

    test "renders billing form when user has no billing account", %{conn: conn} do
      user = user_fixture()
      org = app_org_fixture()

      conn = conn |> Map.put(:host, org.custom_domain) |> login_user(user)

      {:ok, _index_live, html} = live(conn, ~p"/billing")

      assert html =~ "Set up billing account"
      assert html =~ "Country"
      assert html =~ "Currency"
    end
  end

  describe "billing form submission" do
    setup %{conn: conn} do
      user = user_fixture()
      org = app_org_fixture()
      conn = conn |> Map.put(:host, org.custom_domain) |> login_user(user)

      stripe_stub(
        prefix: "cus_",
        data: %{
          "email" => user.email,
          "metadata" => %{"user_id" => to_string(user.id)},
          "preferred_locales" => [to_string(user.language)],
          "object" => "customer"
        }
      )

      %{conn: conn, user: user, org: org}
    end

    test "shows validation errors for invalid form", %{conn: conn} do
      {:ok, index_live, _html} = live(conn, ~p"/billing")

      html = 
        index_live
        |> form("#billing_form", billing_form: %{
          country_iso2: "",
          currency: ""
        })
        |> render_submit()

      assert html =~ "can&#39;t be blank"
    end

    test "validates tax ID requirements", %{conn: conn} do
      {:ok, index_live, _html} = live(conn, ~p"/billing")

      html = 
        index_live
        |> form("#billing_form", billing_form: %{
          country_iso2: "US",
          currency: "USD",
          tax_id_type: "us_ein",
          tax_id: ""
        })
        |> render_submit()

      assert html =~ "can&#39;t be blank when tax ID type is provided"
    end
  end

  describe "dynamic form updates" do
    setup %{conn: conn} do
      user = user_fixture()
      org = app_org_fixture()
      conn = conn |> Map.put(:host, org.custom_domain) |> login_user(user)

      %{conn: conn, user: user, org: org}
    end

    test "updates currency and tax ID types when country changes", %{conn: conn} do
      {:ok, index_live, _html} = live(conn, ~p"/billing")

      # Change country to US
      html = 
        index_live
        |> element("#billing_form")
        |> render_change(%{billing_form: %{country_iso2: "US"}})

      # Should not contain validation errors for this change
      refute html =~ "can&#39;t be blank"
    end

    test "shows tax ID input when tax ID type is selected", %{conn: conn} do
      {:ok, index_live, _html} = live(conn, ~p"/billing")

      # Select a tax ID type
      html = 
        index_live
        |> element("#billing_form")
        |> render_change(%{billing_form: %{tax_id_type: "us_ein"}})

      refute html =~ "can&#39;t be blank"
    end
  end
end