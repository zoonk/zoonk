defmodule Zoonk.Billing.UserSubscription do
  @moduledoc """
  Defines the `UserSubscription` schema.

  This schema manages user subscriptions to different plans.
  It tracks the subscription status, payment terms, plan type,
  and expiration details.

  ## Fields

  | Field Name               | Type          | Description                                         |
  |--------------------------|---------------|-----------------------------------------------------|
  | `org_id`                 | `Integer`     | Reference to `Zoonk.Orgs.Org`                       |
  | `user_id`                | `Integer`     | Reference to `Zoonk.Accounts.User`                  |
  | `stripe_subscription_id` | `String`      | Stripe subscription ID.                             |
  | `plan`                   | `Ecto.Enum`   | The subscription plan type.                         |
  | `interval`               | `Ecto.Enum`   | Payment frequency (monthly, yearly).                |
  | `status`                 | `Ecto.Enum`   | Current status of the subscription.                 |
  | `expires_at`             | `DateTime`    | When the subscription expires.                      |
  | `cancel_at_period_end`   | `Boolean`     | Whether to cancel at the end of the current period. |
  | `inserted_at`            | `DateTime`    | Timestamp when the subscription was created.        |
  | `updated_at`             | `DateTime`    | Timestamp when the subscription was last updated.   |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Orgs.Org

  schema "user_subscriptions" do
    belongs_to :org, Org
    belongs_to :user, User

    field :stripe_subscription_id, :string
    field :plan, Ecto.Enum, values: [:free, :plus], default: :free
    field :interval, Ecto.Enum, values: [:monthly, :yearly], default: :monthly

    field :status, Ecto.Enum,
      values: [:incomplete, :incomplete_expired, :trialing, :active, :past_due, :canceled, :unpaid, :paused],
      default: :incomplete

    field :expires_at, :utc_datetime
    field :cancel_at_period_end, :boolean, default: false

    timestamps(type: :utc_datetime_usec)
  end

  @doc """
  Creates a changeset for a user subscription.
  """
  def changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [:plan, :interval, :status, :expires_at, :cancel_at_period_end, :stripe_subscription_id])
    |> validate_required([:plan, :interval, :status, :expires_at, :cancel_at_period_end])
  end
end
