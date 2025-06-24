defmodule ZoonkWeb.AppLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :scope, Zoonk.Scope, required: true
  attr :flash, :map, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main class="min-h-dvh flex flex-col p-4">
      <.navbar user={@scope.user} />
      {render_slot(@inner_block)}
      <.flash_group flash={@flash} />
    </main>
    """
  end
end
