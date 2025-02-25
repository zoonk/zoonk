defmodule ZoonkWeb.Components.Anchor do
  @moduledoc false
  use Phoenix.Component

  attr :class, :string, default: nil, doc: "CSS class to apply to the anchor"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the anchor"
  slot :inner_block, required: true

  def a(assigns) do
    ~H"""
    <.link
      class={[
        "text-zk-link font-medium",
        "hover:text-zk-link-hover hover:underline",
        "active:text-zk-link-active",
        "focus-visible:text-zk-link-hover focus-visible:underline",
        "dark:text-zk-link-inverse dark:hover:text-zk-link-inverse",
        "dark:focus-visible:text-zk-link-inverse",
        "dark:active:text-zk-link-inverse",
        "contrast-more:text-zk-link-active",
        "contrast-more:hover:text-zk-link-hover",
        "contrast-more:focus-visible:text-zk-link-hover",
        "dark:contrast-more:text-zk-link-inverse-hover",
        "dark:contrast-more:hover:text-zk-link-inverse",
        @class
      ]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.link>
    """
  end
end
