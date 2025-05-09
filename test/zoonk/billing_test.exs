defmodule Zoonk.BillingTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.BillingFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Billing
  alias Zoonk.Billing.Price
  alias Zoonk.Billing.UserSubscription
  alias Zoonk.Scope

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
      assert first_price.plan == "starter_monthly"
      assert first_price.periodicity == "monthly"
      assert first_price.currencies["usd"] == 5
      assert first_price.currencies["brl"] == 19.90
    end

    test "returns error when Stripe API fails" do
      stripe_stub(error: true)
      assert {:error, "Invalid request"} = Billing.list_prices()
    end
  end

  describe "create_user_subscription/2" do
    test "creates a subscription with valid data" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      attrs = valid_user_subscription_attrs()

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.user_id == user.id
      assert subscription.org_id == org.id
      assert subscription.plan == attrs.plan
      assert subscription.payment_term == attrs.payment_term
      assert subscription.status == attrs.status
      assert subscription.stripe_subscription_id == attrs.stripe_subscription_id
      assert subscription.expires_at == attrs.expires_at
      refute subscription.cancel_at_period_end
    end

    test "cannot override user_id from scope" do
      user = user_fixture()
      another_user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      attrs = valid_user_subscription_attrs(%{user_id: another_user.id})

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.user_id == user.id
    end

    test "cannot override org_id from scope" do
      user = user_fixture()
      org = org_fixture()
      another_org = org_fixture()
      scope = %Scope{user: user, org: org}

      attrs = valid_user_subscription_attrs(%{org_id: another_org.id})

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.org_id == org.id
    end

    test "returns error with invalid data" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}
      invalid_attrs = %{}

      assert {:error, %Ecto.Changeset{}} = Billing.create_user_subscription(scope, invalid_attrs)
    end

    test "sets correct default values" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Only providing required fields, letting defaults handle the rest
      expires_at = DateTime.add(DateTime.utc_now(), 30, :day)

      attrs = %{
        status: :active,
        expires_at: expires_at
      }

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.plan == :free
      assert subscription.payment_term == :monthly
      assert subscription.status == :active
      assert subscription.expires_at == expires_at
      refute subscription.cancel_at_period_end
    end
  end
end
