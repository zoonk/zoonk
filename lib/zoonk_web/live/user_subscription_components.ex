defmodule ZoonkWeb.UserSubscriptionComponents do
  @moduledoc false
  use ZoonkWeb, :html

  @doc """
  Renders a subscription form with radio input groups for plan selection.

  ## Examples

      <.subscription phx-submit="subscribe">
        <.subscription_item value="free" name="plan" checked={@selected_plan == :free}>
          <.subscription_header>
            <.subscription_title>Free</.subscription_title>
            <.subscription_price>$0</.subscription_price>
          </.subscription_header>

          <.subscription_features>
            <.subscription_feature icon="tabler-book">
              Access to all courses
            </.subscription_feature>
          </.subscription_features>
        </.subscription_item>

        <.subscription_submit disclaimer="This is a limited plan.">
          Subscribe
        </.subscription_submit>
      </.subscription>
  """
  attr :class, :string, default: nil
  attr :rest, :global, include: ~w(autocomplete name rel action enctype method novalidate target multipart)

  slot :inner_block, required: true

  def subscription(assigns) do
    ~H"""
    <.form class={["flex flex-col gap-8", @class]} {@rest}>
      {render_slot(@inner_block)}
    </.form>
    """
  end

  @doc """
  Renders a subscription price with optional label and original price.

  ## Examples

      <.subscription_price label="/month">$10</.subscription_price>
      <.subscription_price label="/month" original_price="$15">$10</.subscription_price>
  """
  attr :label, :string, default: nil
  attr :class, :string, default: nil

  slot :inner_block, required: true

  def subscription_price(assigns) do
    ~H"""
    <div class={["flex items-baseline gap-1", @class]}>
      <.text tag="span" size={:md} weight={:bold}>
        {render_slot(@inner_block)}
      </.text>

      <.text :if={@label} tag="span" size={:sm} variant={:secondary}>
        {@label}
      </.text>
    </div>
    """
  end

  @doc """
  Renders a submit button for subscription forms.

  ## Examples

      <.subscription_submit>Subscribe</.subscription_submit>
      <.subscription_submit disabled={true}>Subscribe</.subscription_submit>
  """
  attr :disclaimer, :string, required: true
  attr :class, :string, default: nil
  attr :variant, :atom, values: [:primary, :destructive], default: :primary
  attr :rest, :global, include: ~w(disabled)

  slot :inner_block, required: true

  def subscription_submit(assigns) do
    ~H"""
    <div class={["mx-auto flex max-w-xs flex-col items-center justify-center gap-3", @class]}>
      <.text size={:xs} variant={:secondary} class="text-center">
        {@disclaimer}
      </.text>

      <.button
        type="submit"
        icon={menu_icon(:subscription)}
        phx-disable
        variant={@variant}
        size={:md}
        class="w-fit"
        {@rest}
      >
        {render_slot(@inner_block)}
      </.button>
    </div>
    """
  end
end
