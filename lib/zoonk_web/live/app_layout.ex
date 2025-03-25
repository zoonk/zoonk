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
          <.sidebar_menu_item>
            <.sidebar_menu_link navigate={~p"/"} active={@active_page == :home} icon="tabler-home">
              Home
            </.sidebar_menu_link>
          </.sidebar_menu_item>

          <.sidebar_menu_item>
            <.sidebar_menu_link
              navigate={~p"/goals"}
              active={@active_page == :goals}
              icon="tabler-target"
            >
              Goals
            </.sidebar_menu_link>
          </.sidebar_menu_item>

          <.sidebar_menu_item>
            <.sidebar_menu_link
              navigate={~p"/catalog"}
              active={@active_page == :catalog}
              icon="tabler-book"
            >
              Catalog
            </.sidebar_menu_link>
          </.sidebar_menu_item>

          <.sidebar_menu_item>
            <.sidebar_menu_link
              navigate={~p"/library"}
              active={@active_page == :library}
              icon="tabler-books"
            >
              Library
            </.sidebar_menu_link>
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu class="mt-auto">
          <.sidebar_menu_item>
            <.sidebar_menu_link
              navigate={~p"/user/email"}
              active={@active_page == :user_email}
              icon="tabler-mail"
            >
              Email Settings
            </.sidebar_menu_link>
          </.sidebar_menu_item>

          <.sidebar_menu_item>
            <.sidebar_menu_link href={~p"/logout"} method="delete" icon="tabler-logout">
              Logout
            </.sidebar_menu_link>
          </.sidebar_menu_item>
        </.sidebar_menu>
      </.sidebar>

      <div class="flex-1 p-6">
        {render_slot(@inner_block)}
        <.flash_group flash={@flash} />
      </div>
    </main>
    """
  end
end
