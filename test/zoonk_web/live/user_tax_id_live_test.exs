defmodule ZoonkWeb.UserTaxIdLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.BillingFixtures

  describe "tax ID form for Brazilian users" do
    setup :signup_and_login_user

    test "redirects Brazilian users with existing tax IDs to subscription page", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope, "country_iso2" => "BR", "currency" => "BRL"})

      stripe_stub(data: %{"data" => [%{"id" => "txi_123", "type" => "br_cpf"}]})

      conn
      |> visit(~p"/tax-id")
      |> assert_path(~p"/subscription")
    end

    test "redirects non-Brazilian users to subscription page", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope, "country_iso2" => "US", "currency" => "USD"})

      conn
      |> visit(~p"/tax-id")
      |> assert_path(~p"/subscription")
    end

    test "redirects users without billing account to subscription page", %{conn: conn} do
      conn
      |> visit(~p"/tax-id")
      |> assert_path(~p"/subscription")
    end

    test "successfully adds CPF", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope, "country_iso2" => "BR", "currency" => "BRL"})

      stripe_stub(data: %{"data" => []})

      conn
      |> visit(~p"/tax-id")
      |> select("Document Type", option: "CPF")
      |> fill_in("Document Number", with: "12345678901")
      |> submit()
      |> assert_path(~p"/subscription")
    end

    test "successfully adds CNPJ", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope, "country_iso2" => "BR", "currency" => "BRL"})

      stripe_stub(data: %{"data" => []})

      conn
      |> visit(~p"/tax-id")
      |> select("Document Type", option: "CNPJ")
      |> fill_in("Document Number", with: "12345678000195")
      |> submit()
      |> assert_path(~p"/subscription")
    end

    test "validates required fields", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope, "country_iso2" => "BR", "currency" => "BRL"})

      stripe_stub(data: %{"data" => []})

      conn
      |> visit(~p"/tax-id")
      |> fill_in("Document Number", with: "")
      |> assert_has("p", text: "can't be blank")
    end

    test "allows skipping tax ID addition", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope, "country_iso2" => "BR", "currency" => "BRL"})

      stripe_stub(data: %{"data" => []})

      conn
      |> visit(~p"/tax-id")
      |> click_link("Skip")
      |> assert_path(~p"/subscription")
    end
  end
end
