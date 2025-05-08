defmodule Zoonk.BillingTest do
  use Zoonk.DataCase

  import Zoonk.BillingFixtures

  alias Zoonk.Billing

  describe "list_prices/0" do
    test "returns all prices when successful" do
      # Stub the Stripe API response with mock prices data
      stripe_stub(
        data: %{
          "data" => [
            %{
              "id" => "price_starter_monthly",
              "lookup_key" => "starter_monthly",
              "unit_amount" => 500,
              "active" => true
            }
          ]
        }
      )

      assert {:ok, prices} = Billing.list_prices()

      first_price = hd(prices)
      assert first_price["id"] == "price_starter_monthly"
      assert first_price["lookup_key"] == "starter_monthly"
      assert first_price["unit_amount"] == 500
      assert first_price["active"] == true
    end

    test "returns error when Stripe API fails" do
      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.list_prices()
    end
  end
end
