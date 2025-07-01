defmodule Zoonk.Billing do
  @moduledoc """
  Handles billing operations for the application.

  This context provides functions for managing subscriptions, processing payments,
  and integrating with payment providers such as Stripe.
  """

  alias Zoonk.Accounts.User
  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Billing.Price
  alias Zoonk.Billing.Stripe
  alias Zoonk.Billing.UserSubscription
  alias Zoonk.Repo
  alias Zoonk.Scope

  @doc """
  Creates a billing account.

  Takes a User struct and attributes to create a new billing account record.
  First creates a Stripe customer for the user, then creates the billing account
  with the Stripe customer ID.

  ## Examples

      iex> user = %User{id: 123, email: "user@example.com"}
      iex> create_billing_account(user, %{currency: "USD"})
      {:ok, %BillingAccount{}}

      iex> user = %User{id: 123, email: "user@example.com"}
      iex> create_billing_account(user, %{})
      {:error, %Ecto.Changeset{}}
  """
  def create_billing_account(%User{} = user, attrs) do
    with {:ok, stripe_customer} <- create_stripe_customer(user) do
      attrs =
        attrs
        |> Map.put(:user_id, user.id)
        |> Map.put(:stripe_customer_id, stripe_customer["id"])

      %BillingAccount{}
      |> BillingAccount.changeset(attrs)
      |> Repo.insert()
    end
  end

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
    attrs =
      attrs
      |> Map.merge(%{user_id: user.id, org_id: org.id})
      |> maybe_set_lifetime_expiration()

    %UserSubscription{}
    |> UserSubscription.changeset(attrs)
    |> Repo.insert()
  end

  # Use a far future date (Dec 31, 9999) for lifetime subscriptions
  defp maybe_set_lifetime_expiration(%{payment_term: :lifetime} = attrs) do
    Map.put(attrs, :expires_at, ~U[9999-12-31 23:59:59Z])
  end

  # For non-lifetime subscriptions, keep the original attrs we get from Stripe
  defp maybe_set_lifetime_expiration(attrs), do: attrs

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

  @doc """
  Cancels a user subscription.

  Updates the subscription status to `:canceled` and sets `cancel_at_period_end` to `true`.
  Also cancels the subscription in Stripe if a Stripe subscription ID exists.

  ## Examples

      iex> cancel_user_subscription(scope, subscription)
      {:ok, %UserSubscription{}}

      iex> cancel_user_subscription(scope, subscription)
      {:error, %Ecto.Changeset{}}
  """
  def cancel_user_subscription(%Scope{} = scope, %UserSubscription{} = subscription) do
    subscription
    |> cancel_stripe_subscription()
    |> cancel_user_subscription(scope, subscription, %{status: :canceled, cancel_at_period_end: true})
  end

  @doc """
  Creates a customer in Stripe.

  Takes a User struct and creates a new customer record in Stripe using the user's
  email, ID, and language preferences.

  ## Examples

      iex> user = %User{id: 123, email: "user@example.com", language: :en}
      iex> create_stripe_customer(user)
      {:ok, %{"id" => "cus_1234567890", "email" => "user@example.com"}}

      iex> create_stripe_customer(%User{email: nil})
      {:error, "Invalid request"}
  """
  def create_stripe_customer(%User{} = user) do
    attrs = %{
      "email" => user.email,
      "metadata[user_id]" => user.id,
      "preferred_locales[]" => Atom.to_string(user.language)
    }

    Stripe.post("/customers", attrs)
  end

  defp cancel_user_subscription({:ok, _status}, scope, subscription, attrs) do
    update_user_subscription(scope, subscription, attrs)
  end

  defp cancel_user_subscription({:error, message}, _scope, _subscription, _attrs) do
    {:error, message}
  end

  # Don't call the Stripe API if the user isn't using Stripe
  defp cancel_stripe_subscription(%UserSubscription{stripe_subscription_id: nil}) do
    {:ok, %{"status" => "canceled"}}
  end

  # Cancels a Stripe subscription if a subscription ID exists
  defp cancel_stripe_subscription(%UserSubscription{stripe_subscription_id: subscription_id}) do
    Stripe.delete("/subscriptions/#{subscription_id}")
  end
end
