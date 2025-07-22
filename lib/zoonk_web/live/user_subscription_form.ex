defmodule ZoonkWeb.UserSubscriptionForm do
  @moduledoc false
  use ZoonkWeb, :html
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.UserSubscriptionComponents

  alias Zoonk.Billing.Price
  alias Zoonk.Locations

  @plans [:free, :plus]
  @intervals [:monthly, :yearly]

  attr :current_plan, :atom, values: @plans, required: true
  attr :selected_plan, :atom, values: @plans, required: true
  attr :interval, :atom, values: @intervals, required: true
  attr :prices, :list, required: true

  def subscription_form(assigns) do
    ~H"""
    <.subscription
      action={form_action(@selected_plan, @current_plan)}
      method="post"
      phx-change="change_plan"
      phx-submit={phx_submit_action(@selected_plan, @current_plan)}
      class="w-full max-w-4xl"
    >
      <input
        :if={@selected_plan != :free}
        type="hidden"
        name="price"
        value={price(@prices, @selected_plan, @interval).stripe_price_id}
      />

      <div class="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        <.subscription_item
          :for={plan <- available_plans()}
          value={Atom.to_string(plan.key)}
          name="plan"
          label={plan.label}
          checked={@selected_plan == plan.key}
        >
          <.subscription_header>
            <.subscription_title
              badge_label={badge_label(plan.key, @current_plan, @interval)}
              badge_color={badge_color(plan.key, @current_plan)}
            >
              {plan.label}
            </.subscription_title>

            <.subscription_price>
              {price_value(@prices, plan.key, @interval)}
            </.subscription_price>
          </.subscription_header>

          <.subscription_features :for={feature <- plan.features}>
            <.subscription_feature icon={feature.icon}>
              {feature.text}
            </.subscription_feature>
          </.subscription_features>
        </.subscription_item>
      </div>

      <.subscription_submit
        disabled={@selected_plan == :free && @current_plan == :free}
        disclaimer={disclaimer_text(@selected_plan, @interval, @prices)}
        variant={submit_variant(@selected_plan, @current_plan)}
      >
        {submit_label(@selected_plan, @current_plan)}
      </.subscription_submit>
    </.subscription>
    """
  end

  defp price(prices, plan, interval) do
    Enum.find(prices, &match?(%Price{plan: ^plan, interval: ^interval}, &1))
  end

  defp price_value([], _plan, _interval), do: "$0"

  defp price_value([%Price{currency: currency} | _rest], :free, _interval) do
    symbol = Locations.get_currency_symbol(currency) || "$"
    "#{symbol}0"
  end

  defp price_value(prices, plan, interval) do
    prices
    |> price(plan, interval)
    |> Map.get(:value, "$0")
  end

  defp disclaimer_text(:free, _interval, _prices) do
    dgettext("settings", "This is a limited plan. You will not be charged anything unless you upgrade to a paid plan.")
  end

  defp disclaimer_text(:plus, interval, prices) do
    prices
    |> price_value(:plus, interval)
    |> disclaimer_price_label(interval)
    |> plus_disclaimer()
  end

  defp disclaimer_price_label(price, :monthly), do: dgettext("settings", "%{price}/month", price: price)
  defp disclaimer_price_label(price, :yearly), do: dgettext("settings", "%{price}/year", price: price)

  defp plus_disclaimer(disclaimer_price_label) do
    dgettext(
      "settings",
      "Your subscription will renew automatically at %{price}. You can cancel it at any time.",
      price: disclaimer_price_label
    )
  end

  defp badge_label(plan, current_plan, _interval) when plan == current_plan, do: dgettext("settings", "Current Plan")
  defp badge_label(:plus, _current_plan, :yearly), do: dgettext("settings", "2 Months Free")
  defp badge_label(_plan, _current_plan, _interval), do: nil

  defp badge_color(plan, current_plan) when plan == current_plan, do: :secondary
  defp badge_color(_plan, _current_plan), do: :primary

  defp available_plans do
    [
      %{
        key: :free,
        label: dgettext("settings", "Free"),
        features: [
          %{icon: "tabler-book", text: dgettext("settings", "Access to all courses")},
          %{icon: "tabler-calendar", text: dgettext("settings", "1 lesson per day")},
          %{icon: "tabler-refresh", text: dgettext("settings", "Regular updates")}
        ]
      },
      %{
        key: :plus,
        label: dgettext("settings", "Plus"),
        features: [
          %{icon: "tabler-infinity", text: dgettext("settings", "Unlimited lessons")},
          %{icon: "tabler-headset", text: dgettext("settings", "Priority support")},
          %{icon: "tabler-plus", text: dgettext("settings", "Everything in Free")}
        ]
      }
    ]
  end

  defp submit_label(:free, :plus), do: dgettext("settings", "Cancel Subscription")
  defp submit_label(selected, current) when selected == current, do: dgettext("settings", "Manage Subscription")
  defp submit_label(_selected, _current), do: dgettext("settings", "Subscribe")

  defp submit_variant(:free, :plus), do: :destructive
  defp submit_variant(_selected, _current), do: :primary

  defp phx_submit_action(:free, :plus), do: "cancel"
  defp phx_submit_action(_selected, _current), do: nil

  defp form_action(:free, :plus), do: nil
  defp form_action(:plus, :plus), do: ~p"/subscription/manage"
  defp form_action(_selected, _current), do: ~p"/subscription/checkout"
end
