defmodule ZoonkWeb.Components.Card do
  @moduledoc """
  Card components.
  """
  use Phoenix.Component

  @doc """
  Renders a card.

  ## Examples

      <.card>
        <.text element={:h3} size={:title} variant={:primary}>Card Title</.text>
        <.text element={:p} size={:body} variant={:secondary}>Card content goes here.</.text>
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
        "bg-zk-surface rounded-md p-4",
        "border-zk-border border dark:border-zk-border-inverse",
        "dark:bg-zk-surface-inverse",
        @class
      ]}
    >
      {render_slot(@inner_block)}
    </.dynamic_tag>
    """
  end
end
