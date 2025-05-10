defmodule Zoonk.BillingFixtures do
  @moduledoc false

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Billing
  alias Zoonk.Scope

  def stripe_stub(opts \\ [])

  def stripe_stub(error: true) do
    Req.Test.stub(:stripe_client, fn conn ->
      Req.Test.json(conn, %{"error" => %{"message" => "Invalid request"}})
    end)
  end

  def stripe_stub(opts) do
    prefix = Keyword.get(opts, :prefix, "/cust_")
    id = "#{prefix}#{System.unique_integer([:positive])}"
    data = Keyword.get(opts, :data, %{})

    Req.Test.stub(:stripe_client, fn conn ->
      Req.Test.json(conn, Map.merge(%{"id" => id}, data))
    end)
  end

  @doc """
  Generates a valid user subscription attribute map.

  ## Examples

      iex> valid_user_subscription_attrs()
      %{plan: :starter, payment_term: :monthly, ...}

      iex> valid_user_subscription_attrs(%{plan: :premium})
      %{plan: :premium, payment_term: :monthly, ...}

  """
  def valid_user_subscription_attrs(attrs \\ %{}) do
    expires_at = Map.get(attrs, :expires_at, DateTime.add(DateTime.utc_now(), 30, :day))

    Enum.into(attrs, %{
      plan: :starter,
      payment_term: :monthly,
      status: :active,
      expires_at: expires_at,
      cancel_at_period_end: false,
      stripe_subscription_id: "sub_#{System.unique_integer([:positive])}"
    })
  end

  @doc """
  Creates a user subscription for testing.

  ## Examples

      iex> user_subscription_fixture()
      %UserSubscription{}

      iex> user_subscription_fixture(%{plan: :premium})
      %UserSubscription{plan: :premium}

  """
  def user_subscription_fixture(attrs \\ %{}) do
    user = Map.get_lazy(attrs, :user, fn -> user_fixture() end)
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)
    scope = %Scope{user: user, org: org}

    attrs = valid_user_subscription_attrs(attrs)

    {:ok, subscription} = Billing.create_user_subscription(scope, attrs)
    subscription
  end

  @doc """
  Generates a valid billing account attribute map.

  ## Examples

      iex> valid_billing_account_attrs()
      %{currency: :usd, user_id: 123}

      iex> valid_billing_account_attrs(%{currency: :eur})
      %{currency: :eur, user_id: 123}

  """
  def valid_billing_account_attrs(attrs \\ %{}) do
    org = Map.get(attrs, :org)
    user = Map.get(attrs, :user)
    attrs = maybe_add_attrs(%{currency: :usd, stripe_customer_id: "cus_#{System.unique_integer([:positive])}"}, org, user)

    Enum.into(attrs, attrs)
  end

  defp maybe_add_attrs(attrs, %{} = org, nil), do: Map.put(attrs, :org_id, org.id)
  defp maybe_add_attrs(attrs, nil, %{} = user), do: Map.put(attrs, :user_id, user.id)
  defp maybe_add_attrs(attrs, _org, _user), do: Map.put(attrs, :user_id, user_fixture().id)

  @doc """
  Creates a billing account for testing.

  ## Examples

      iex> billing_account_fixture()
      %BillingAccount{}

      iex> billing_account_fixture(%{currency: :eur})
      %BillingAccount{currency: :eur}

  """
  def billing_account_fixture(attrs \\ %{}) do
    attrs = valid_billing_account_attrs(attrs)

    {:ok, billing_account} = Billing.create_billing_account(attrs)
    billing_account
  end
end
