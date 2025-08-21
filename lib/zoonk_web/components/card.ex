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
  attr :size, :atom, values: [:auto, :full], default: :full, doc: "The size of the card. Can be :auto or :full"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card container"
  slot :inner_block, required: true, doc: "the inner block that renders the card content"

  def card(assigns) do
    ~H"""
    <.dynamic_tag
      tag_name={@tag}
      class={[
        "bg-zk-background border-zk-border rounded drop-shadow",
        "has-[header]:border has-[header]:drop-shadow-none",
        @size == :full && "flex h-full w-full flex-col justify-between",
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
  attr :icon, :string, default: nil, doc: "The icon to use for the card header"
  slot :inner_block, required: true, doc: "the inner block that renders the card header"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card header"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card header"

  def card_header(assigns) do
    ~H"""
    <header
      class={["bg-zk-muted flex w-full items-center justify-between gap-4 rounded-t p-6", @class]}
      {@rest}
    >
      <div class="flex flex-col gap-1.5">{render_slot(@inner_block)}</div>
      <.icon :if={@icon} size={:lg} class="text-zk-secondary-foreground" name={@icon} />
    </header>
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
    <.text tag="h3" size={:xl} variant={:primary} {@rest}>
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
    <.text tag="h4" size={:sm} variant={:secondary} class={@class} {@rest}>
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

      <.card_content align={:top}>
        <.text>This content is aligned to the top.</.text>
      </.card_content>

      <.card_content align={:center}>
        <.text>This content is centered vertically.</.text>
      </.card_content>

      <.card_content align={:bottom}>
        <.text>This content is aligned to the bottom.</.text>
      </.card_content>
  """
  attr :tag, :string, default: "div", doc: "The HTML tag to use for the card content"

  attr :align, :atom,
    default: :top,
    values: [:top, :center, :bottom],
    doc: "The alignment of the content within the card. Can be :top, :center, or :bottom"

  slot :inner_block, required: true, doc: "the inner block that renders the card content"
  attr :class, :any, default: nil, doc: "CSS class to apply to the card content"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the card content"

  def card_content(assigns) do
    ~H"""
    <.dynamic_tag
      tag_name={@tag}
      class={[
        "w-full p-6",
        @align == :top && "mb-auto",
        @align == :center && "my-auto",
        @align == :bottom && "mt-auto",
        @class
      ]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.dynamic_tag>
    """
  end
end
