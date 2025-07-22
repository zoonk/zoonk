defmodule ZoonkWeb.UserSubscriptionComponents do
  @moduledoc false
  use Phoenix.Component

  import ZoonkWeb.Components.Button
  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

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
  Renders a subscription plan item with radio input for selection.

  This component uses radio inputs for semantic correctness and accessibility.

  ## Examples

      <.subscription_item value="plus" name="plan" checked={true}>
        Content goes here
      </.subscription_item>
  """
  attr :value, :string, required: true
  attr :name, :string, required: true
  attr :checked, :boolean, default: false
  attr :label, :string, required: true
  attr :class, :string, default: nil

  slot :inner_block, required: true

  def subscription_item(assigns) do
    ~H"""
    <label class="group cursor-pointer select-none">
      <input type="radio" name={@name} value={@value} checked={@checked} class="peer sr-only" />

      <div class={[
        "flex flex-col gap-4 overflow-hidden rounded-xl border p-4 transition-all",
        "border-zk-border",
        "peer-checked:shadow-zk-primary/20 peer-checked:border-zk-primary peer-checked:shadow-md",
        "peer-focus-visible:outline-zk-primary peer-focus-visible:outline-2",
        @class
      ]}>
        {render_slot(@inner_block)}
      </div>
    </label>
    """
  end

  @doc """
  Renders the header section of a subscription item.

  ## Examples

      <.subscription_header>
        <.subscription_title>Plus</.subscription_title>
        <.subscription_price label="/month">$10</.subscription_price>
      </.subscription_header>
  """
  attr :class, :string, default: nil

  slot :inner_block, required: true

  def subscription_header(assigns) do
    ~H"""
    <div class={["flex items-start justify-between", @class]}>
      <div class="flex-1">
        {render_slot(@inner_block)}
      </div>

      <div class={[
        "size-4 flex shrink-0 items-center justify-center",
        "border-zk-border rounded-full border",
        "group-has-[:checked]:border-zk-primary group-has-[:checked]:bg-zk-primary"
      ]}>
        <.icon
          name="tabler-check"
          size={:xs}
          class="text-white opacity-0 transition-opacity group-has-[:checked]:opacity-100"
        />
      </div>
    </div>
    """
  end

  @doc """
  Renders a subscription plan title with optional current plan badge.

  ## Examples

      <.subscription_title>Plus</.subscription_title>
      <.subscription_title badge_label="Current Plan" badge_color={:secondary}>Plus</.subscription_title>
  """
  attr :badge_label, :string, default: nil
  attr :badge_color, :atom, values: [:primary, :secondary], default: :primary
  attr :class, :string, default: nil

  slot :inner_block, required: true

  def subscription_title(assigns) do
    ~H"""
    <.text
      tag="h3"
      size={:md}
      weight={:semibold}
      class={["flex items-center gap-2 leading-6", @class]}
    >
      {render_slot(@inner_block)}

      <span
        :if={@badge_label}
        class={[
          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
          @badge_color == :primary && "bg-zk-primary text-zk-primary-foreground",
          @badge_color == :secondary && "bg-zk-secondary text-zk-secondary-foreground"
        ]}
      >
        {@badge_label}
      </span>
    </.text>
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
  Renders a container for subscription features.

  ## Examples

      <.subscription_features>
        <.subscription_feature icon="tabler-check">Feature 1</.subscription_feature>
        <.subscription_feature icon="tabler-check">Feature 2</.subscription_feature>
      </.subscription_features>
  """
  attr :class, :string, default: nil

  slot :inner_block, required: true

  def subscription_features(assigns) do
    ~H"""
    <div class={["flex flex-col gap-2", @class]}>
      {render_slot(@inner_block)}
    </div>
    """
  end

  @doc """
  Renders a single subscription feature with icon.

  ## Examples

      <.subscription_feature icon="tabler-check">Unlimited exercises</.subscription_feature>
  """
  attr :icon, :string, required: true
  attr :class, :string, default: nil

  slot :inner_block, required: true

  def subscription_feature(assigns) do
    ~H"""
    <div class={["flex items-center gap-2", @class]}>
      <div class="text-zk-primary-text flex shrink-0 items-center justify-center">
        <.icon name={@icon} class="size-4" />
      </div>

      <.text size={:sm} variant={:secondary}>
        {render_slot(@inner_block)}
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
        icon="tabler-diamond"
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
