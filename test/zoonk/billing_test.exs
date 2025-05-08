defmodule Zoonk.BillingTest do
  use Zoonk.DataCase

  import Zoonk.BillingFixtures

  alias Zoonk.Billing
  alias Zoonk.Billing.Price

  describe "list_prices/0" do
    test "returns all prices when successful" do
      stripe_stub(
        data: %{
          "data" => [
            %{
              "id" => "price_starter_monthly",
              "lookup_key" => "starter_monthly",
              "unit_amount" => 500,
              "active" => true,
              "currency_options" => %{
                "usd" => %{"unit_amount" => 500},
                "brl" => %{"unit_amount" => 1990}
              }
            }
          ]
        }
      )

      assert {:ok, prices} = Billing.list_prices()

      assert %Price{} = first_price = hd(prices)
      assert first_price.plan == :starter_monthly
      assert first_price.periodicity == :monthly
      assert first_price.currencies.usd == 5
      assert first_price.currencies.brl == 19.90
    end

    test "returns error when Stripe API fails" do
      stripe_stub(error: true)
      assert {:error, "Invalid request"} = Billing.list_prices()
    end
  end
end
