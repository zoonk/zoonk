defmodule ZoonkWeb.AppLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :page_title, :string, required: true
  attr :scope, Zoonk.Scope, required: true
  attr :flash, :map, required: true
  attr :active_page, :atom, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main>
      {render_slot(@inner_block)}
      <.flash_group flash={@flash} />
    </main>
    """
  end
end
