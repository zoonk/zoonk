defmodule ZoonkWeb.OrgLayout do
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

        <.sidebar_menu heading={gettext("Organization")}>
          <.sidebar_menu_item
            navigate={~p"/org"}
            active={@active_page == :home}
            icon="tabler-building"
          >
            {gettext("Overview")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/teams"}
            active={@active_page == :teams}
            icon="tabler-users"
          >
            {gettext("Teams")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/members"}
            active={@active_page == :members}
            icon="tabler-user-circle"
          >
            {gettext("Members")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/settings"}
            active={@active_page == :settings}
            icon="tabler-settings"
          >
            {gettext("Settings")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/billing"}
            active={@active_page == :billing}
            icon="tabler-credit-card"
          >
            {gettext("Billing")}
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
