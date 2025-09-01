defmodule ZoonkWeb.Components.Info do
  @moduledoc false
  use Phoenix.Component

  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

  attr :class, :string, default: nil
  slot :inner_block, required: true

  def info(assigns) do
    ~H"""
    <section class={["flex flex-col gap-8", @class]}>
      {render_slot(@inner_block)}
    </section>
    """
  end

  attr :class, :string, default: nil
  slot :inner_block, required: true

  def info_card(assigns) do
    ~H"""
    <dl class={["border-zk-border flex flex-col gap-4 rounded-xl border p-4", @class]}>
      {render_slot(@inner_block)}
    </dl>
    """
  end

  attr :icon, :string, required: true
  attr :title, :string, required: true
  attr :subtitle, :string, required: true

  def info_header(assigns) do
    ~H"""
    <header class="flex items-center gap-2">
      <div class="bg-zk-primary-foreground size-11 flex items-center justify-center rounded-full p-2">
        <.icon name={@icon} class="text-zk-primary-text" />
      </div>

      <div class="flex flex-1 flex-col justify-center overflow-hidden">
        <.text tag="dt" size={:md} weight={:semibold} class="truncate">{@title}</.text>
        <.text tag="dd" size={:sm} class="truncate" variant={:secondary}>{@subtitle}</.text>
      </div>
    </header>
    """
  end

  slot :inner_block, required: true

  def info_description(assigns) do
    ~H"""
    <.text tag="dd" size={:sm} variant={:secondary}>
      {render_slot(@inner_block)}
    </.text>
    """
  end

  slot :inner_block, required: true

  def info_list(assigns) do
    ~H"""
    <ul class="flex flex-col gap-2">
      {render_slot(@inner_block)}
    </ul>
    """
  end

  attr :icon, :string, required: true
  slot :inner_block, required: true

  def info_list_item(assigns) do
    ~H"""
    <li class="flex items-center gap-2">
      <div class="text-zk-primary-text flex shrink-0 items-center justify-center" aria-hidden>
        <.icon name={@icon} class="size-4" />
      </div>

      <.text tag="span" size={:sm} variant={:secondary}>
        {render_slot(@inner_block)}
      </.text>
    </li>
    """
  end
end
