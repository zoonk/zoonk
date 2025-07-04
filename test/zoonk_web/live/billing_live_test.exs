defmodule ZoonkWeb.BillingLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.BillingFixtures

  alias Zoonk.Billing

  describe "billing setup form" do
    setup :signup_and_login_user

    test "creates billing account successfully", %{conn: conn, scope: scope} do
      stripe_stub(prefix: "cus_")

      conn
      |> visit(~p"/billing")
      |> select("Country", option: "United States")
      |> select("Currency", option: "United States Dollar (USD)")
      |> fill_in("Address line 1", with: "123 Main St")
      |> fill_in("City", with: "San Francisco")
      |> fill_in("State/Province", with: "CA")
      |> fill_in("Postal code", with: "94102")
      |> submit()
      |> assert_path(~p"/subscription")

      assert Billing.get_billing_account(scope)
    end

    test "redirects to subscription page if user already has billing account", %{conn: conn, scope: scope} do
      stripe_stub(prefix: "cus_")

      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/billing")
      |> assert_path(~p"/subscription")
    end

    test "displays validation errors for missing required fields", %{conn: conn} do
      stripe_stub(prefix: "cus_")

      conn
      |> visit(~p"/billing")
      |> fill_in("Address line 1", with: "123 Main St")
      |> submit()
      |> assert_has("p", text: "can't be blank")
    end

    test "redirects to original page when 'from' parameter is provided", %{conn: conn} do
      stripe_stub(prefix: "cus_")

      conn
      |> visit(~p"/billing?from=/purchases")
      |> select("Country", option: "United States")
      |> select("Currency", option: "United States Dollar (USD)")
      |> submit()
      |> assert_path(~p"/purchases")
    end

    test "shows tax ID fields for countries that support them", %{conn: conn} do
      conn
      |> visit(~p"/billing")
      |> select("Country", option: "United States")
      |> assert_has("select[name='billing_account[tax_id_type]']")
      |> assert_has("input[name='billing_account[tax_id]']")
    end

    test "displays all required form fields", %{conn: conn} do
      conn
      |> visit(~p"/billing")
      |> assert_has("select[name='billing_account[country_iso2]']")
      |> assert_has("select[name='billing_account[currency]']")
      |> assert_has("input[name='billing_account[address_line_1]']")
      |> assert_has("input[name='billing_account[address_line_2]']")
      |> assert_has("input[name='billing_account[city]']")
      |> assert_has("input[name='billing_account[state]']")
      |> assert_has("input[name='billing_account[postal_code]']")
    end

    test "updates selected currency based on selected country", %{conn: conn} do
      stripe_stub(prefix: "cus_")

      conn
      |> visit(~p"/billing")
      |> select("Country", option: "United States")
      |> assert_has("select[name='billing_account[currency]'] option[value='USD'][selected]")
      |> select("Country", option: "Canada")
      |> assert_has("select[name='billing_account[currency]'] option[value='CAD'][selected]")
    end

    test "removes tax_id values when switching countries", %{conn: conn} do
      stripe_stub(prefix: "cus_")

      conn
      |> visit(~p"/billing")
      |> select("Country", option: "United States")
      |> fill_in("Tax ID", with: "123456789")
      |> assert_has("input[name='billing_account[tax_id]']", value: "123456789")
      |> select("Country", option: "Canada")
      |> assert_has("input[name='billing_account[tax_id]']", value: "")
    end
  end
end
