defmodule ZoonkWeb.AppLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :scope, Zoonk.Scope, required: true
  attr :page, :atom, values: [:home, :catalog, :start_course, :other], default: :other
  attr :flash, :map, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main class="min-h-dvh flex flex-col gap-4 p-4">
      <.navbar scope={@scope} page={@page} />
      {render_slot(@inner_block)}
      <.flash_group flash={@flash} />
    </main>
    """
  end
end
