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
      <.menu>
        <.menu_group primary>
          <.menu_item
            :for={item <- get_menu_items(:main)}
            primary
            icon={item.icon}
            label={item.label}
            {Map.take(item, [:navigate])}
          />
        </.menu_group>

        <.menu_group heading={gettext("Editor")}>
          <.menu_item
            :for={item <- get_menu_items(:editor)}
            active={item.active == @active_page}
            icon={item.icon}
            label={item.label}
            {Map.take(item, [:navigate])}
          />
        </.menu_group>
      </.menu>

      <div class="bg-zk-background flex-1 p-6">
        {render_slot(@inner_block)}
        <.flash_group flash={@flash} />
      </div>
    </main>
    """
  end

  defp get_menu_items(:main) do
    [
      %{
        navigate: ~p"/",
        icon: "tabler-brain",
        label: gettext("Back to app")
      }
    ]
  end

  defp get_menu_items(:editor) do
    [
      %{
        navigate: ~p"/editor",
        active: :home,
        icon: "tabler-edit",
        label: gettext("Dashboard")
      },
      %{
        navigate: ~p"/editor/new",
        active: :new,
        icon: "tabler-plus",
        label: gettext("Create New")
      }
    ]
  end
end
