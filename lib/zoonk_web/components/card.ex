defmodule ZoonkWeb.Components.Card do
  @moduledoc """
  Card components.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

  @doc """
  Renders a card.

  ## Examples

      <.card>
        <.card_header>
          <.card_title>Card title</.card_title>
          <.card_description>Card description</.card_description>
        </.card_header>

        <.card_content>
          <.text>Card content goes here.</.text>
        </.card_content>
      </.card>
  """
  attr :tag, :string, default: "div", doc: "The HTML tag to use for the card container"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card container"
  slot :inner_block, required: true, doc: "the inner block that renders the card content"

  def card(assigns) do
    ~H"""
    <.dynamic_tag
      tag_name={@tag}
      class={[
        "bg-zk-surface rounded-md",
        "border-zk-border border dark:border-zk-border-inverse",
        "dark:bg-zk-surface-inverse",
        @class
      ]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.dynamic_tag>
    """
  end

  @doc """
  Renders a card header.

  ## Examples

      <.card_header>
        <.card_title>Card title</.card_title>
        <.card_description>Card description</.card_description>
      </.card_header>
  """
  attr :tag, :string, default: "div", doc: "The HTML tag to use for the card header"
  attr :icon, :string, default: nil, doc: "The icon to use for the card header"
  slot :inner_block, required: true, doc: "the inner block that renders the card header"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card header"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card header"

  def card_header(assigns) do
    ~H"""
    <.dynamic_tag
      tag_name={@tag}
      class={[
        "flex items-center justify-between gap-4 rounded-t-md p-6",
        "bg-zk-secondary-50 dark:bg-zk-secondary-800",
        @class
      ]}
      {@rest}
    >
      <div class="flex flex-col gap-1.5">{render_slot(@inner_block)}</div>
      <.icon
        :if={@icon}
        name={@icon}
        class="text-zk-secondary-500 size-10 dark:text-zk-secondary-400"
      />
    </.dynamic_tag>
    """
  end

  @doc """
  Renders a card title.

  ## Examples

      <.card_title>Card title</.card_title>
  """
  attr :tag, :string, default: "div", doc: "The HTML tag to use for the card header"
  slot :inner_block, required: true, doc: "the inner block that renders the card header"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card header"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card header"

  def card_title(assigns) do
    ~H"""
    <.text
      tag="h3"
      size={:title}
      class={["leading-none tracking-tight", @class]}
      variant={:primary}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.text>
    """
  end

  @doc """
  Renders a card description.
  ## Examples

      <.card_description>Card description</.card_description>
  """
  attr :tag, :string, default: "div", doc: "The HTML tag to use for the card header"
  slot :inner_block, required: true, doc: "the inner block that renders the card header"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card header"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card header"

  def card_description(assigns) do
    ~H"""
    <.text tag="h4" size={:caption} variant={:secondary} class={@class} {@rest}>
      {render_slot(@inner_block)}
    </.text>
    """
  end

  @doc """
  Renders a card content.

  ## Examples

      <.card_content>
        <.text>Card content goes here.</.text>
      </.card_content>
  """
  attr :tag, :string, default: "div", doc: "The HTML tag to use for the card content"
  slot :inner_block, required: true, doc: "the inner block that renders the card content"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card content"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card content"

  def card_content(assigns) do
    ~H"""
    <.dynamic_tag tag_name={@tag} class={["p-6", @class]} {@rest}>
      {render_slot(@inner_block)}
    </.dynamic_tag>
    """
  end
end
