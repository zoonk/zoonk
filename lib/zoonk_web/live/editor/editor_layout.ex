defmodule ZoonkWeb.EditorLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :page_title, :string, required: true
  attr :scope, Zoonk.Scope, required: true
  attr :flash, :map, required: true
  attr :active_page, :atom, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main class="flex w-full">
      <.sidebar>
        <.sidebar_menu>
          <.sidebar_menu_item navigate={~p"/"} icon="tabler-brain">
            {gettext("Back to app")}
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu heading={gettext("Editor")}>
          <.sidebar_menu_item navigate={~p"/editor"} active={@active_page == :home} icon="tabler-edit">
            {gettext("Dashboard")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/editor/new"}
            active={@active_page == :new}
            icon="tabler-plus"
          >
            {gettext("Create New")}
          </.sidebar_menu_item>
        </.sidebar_menu>
      </.sidebar>

      <div class="bg-zk-background flex-1 p-6">
        {render_slot(@inner_block)}
        <.flash_group flash={@flash} />
      </div>
    </main>
    """
  end
end
