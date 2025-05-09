defmodule Zoonk.Billing do
  @moduledoc """
  Handles billing operations for the application.

  This context provides functions for managing subscriptions, processing payments,
  and integrating with payment providers such as Stripe.
  """

  alias Zoonk.Billing.Price
  alias Zoonk.Billing.Stripe
  alias Zoonk.Billing.UserSubscription
  alias Zoonk.Repo
  alias Zoonk.Scope

  @doc """
  Creates a user subscription.

  Takes a scope containing the user and org information, along with
  subscription attributes, to create a new user subscription record.

  ## Examples

      iex> create_user_subscription(%Scope{}, %{plan: :starter, payment_term: :monthly})
      {:ok, %UserSubscription{}}

      iex> create_user_subscription(%Scope{}, %{})
      {:error, %Ecto.Changeset{}}
  """
  def create_user_subscription(%Scope{user: user, org: org}, attrs) do
    attrs = Map.merge(attrs, %{user_id: user.id, org_id: org.id})

    %UserSubscription{}
    |> UserSubscription.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates an existing user subscription.

  Takes a scope containing the user and org information, the subscription to update,
  and the attributes to update.

  The user_id and org_id cannot be changed and will be enforced from the scope.

  ## Examples

      iex> update_user_subscription(%Scope{}, subscription, %{plan: :premium})
      {:ok, %UserSubscription{}}

      iex> update_user_subscription(%Scope{}, subscription, %{})
      {:ok, %UserSubscription{}}

      iex> update_user_subscription(%Scope{}, subscription, %{status: :invalid})
      {:error, %Ecto.Changeset{}}
  """
  def update_user_subscription(%Scope{user: user, org: org}, %UserSubscription{} = subscription, attrs) do
    attrs = Map.merge(attrs, %{user_id: user.id, org_id: org.id})

    subscription
    |> UserSubscription.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Lists all available pricing options for plans.

  Returns a list of prices for all plan options (starter, plus, premium)
  with all payment periodicities (monthly, yearly, lifetime).

  ## Examples

      iex> list_prices()
      {:ok, [%Price{}]}

      iex> list_prices()
      {:error, "Failed to fetch prices"}
  """
  def list_prices do
    "/prices"
    |> Stripe.get(stripe_price_params())
    |> list_prices()
  end

  defp list_prices({:ok, %{"data" => prices}}) do
    {:ok, Enum.map(prices, &Price.transform_from_stripe/1)}
  end

  defp list_prices({:error, message}), do: {:error, message}

  defp stripe_price_params do
    [
      {"active", true},
      {"expand[]", "data.currency_options"}
      | Enum.map(stripe_lookup_keys(), &{"lookup_keys[]", &1})
    ]
  end

  defp stripe_lookup_keys do
    ~w[
      starter_monthly starter_yearly starter_lifetime
      plus_monthly    plus_yearly    plus_lifetime
      premium_monthly premium_yearly premium_lifetime
    ]
  end
end
