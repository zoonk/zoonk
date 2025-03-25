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
    <main class="flex w-full">
      <.sidebar>
        <.sidebar_menu>
          <.sidebar_menu_item navigate={~p"/"} active={@active_page == :home} icon="tabler-brain">
            {gettext("Summary")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/goals"}
            active={@active_page == :goals}
            icon="tabler-target-arrow"
          >
            {gettext("Goals")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/catalog"}
            active={@active_page == :catalog}
            icon="tabler-layout-grid"
          >
            {gettext("Catalog")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/library"}
            active={@active_page == :library}
            icon="tabler-stack-2"
          >
            {gettext("Library")}
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu heading={gettext("Editor")}>
          <.sidebar_menu_item
            navigate={~p"/editor"}
            active={@active_page == :editor}
            icon="tabler-edit"
          >
            {gettext("Dashboard")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/editor/new"}
            active={@active_page == :editor_new}
            icon="tabler-plus"
          >
            {gettext("Create New")}
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu heading={gettext("Organization")}>
          <.sidebar_menu_item navigate={~p"/org"} active={@active_page == :org} icon="tabler-building">
            {gettext("Overview")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/teams"}
            active={@active_page == :org_teams}
            icon="tabler-users"
          >
            {gettext("Teams")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/members"}
            active={@active_page == :org_members}
            icon="tabler-user-circle"
          >
            {gettext("Members")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/settings"}
            active={@active_page == :org_settings}
            icon="tabler-settings"
          >
            {gettext("Settings")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/org/billing"}
            active={@active_page == :org_billing}
            icon="tabler-credit-card"
          >
            {gettext("Billing")}
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu heading={gettext("Settings")}>
          <.sidebar_menu_item
            navigate={~p"/user/interests"}
            active={@active_page == :user_interests}
            icon="tabler-star"
          >
            {gettext("Interests")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/user/email"}
            active={@active_page == :user_email}
            icon="tabler-mail"
          >
            {gettext("Email")}
          </.sidebar_menu_item>

          <.sidebar_menu_item
            navigate={~p"/user/billing"}
            active={@active_page == :user_billing}
            icon="tabler-credit-card"
          >
            {gettext("Billing")}
          </.sidebar_menu_item>

          <.sidebar_menu_item destructive href={~p"/logout"} method="delete" icon="tabler-logout">
            {gettext("Logout")}
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
