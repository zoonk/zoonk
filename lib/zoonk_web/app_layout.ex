defmodule ZoonkWeb.AppLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :scope, Zoonk.Scope, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main>
      <.navbar user={@scope.user} />
      {render_slot(@inner_block)}
    </main>
    """
  end
end
