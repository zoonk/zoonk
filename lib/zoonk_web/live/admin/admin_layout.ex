defmodule ZoonkWeb.Admin.AdminLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :page_title, :string, required: true
  attr :flash, :map, required: true
  attr :active_page, :atom, required: true
  attr :back, :map, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main aria-labelledby="page-title">
      <.tab_bar>
        <.nav_menu_item
          active={@active_page == :home}
          label={dgettext("admin", "Dashboard")}
          icon="tabler-dashboard"
          navigate={~p"/admin"}
        />

        <.nav_menu_item
          active={@active_page == :users}
          label={dgettext("admin", "Users")}
          icon="tabler-users"
          navigate={~p"/admin/users"}
        />
      </.tab_bar>

      <div class="bg-zk-surface border-zk-border border-b">
        <header
          class="mx-auto flex items-center justify-between gap-4 p-4 sm:p-6"
          aria-label={gettext("Go back to the app")}
        >
          <.a kind={:button} navigate={@back.link} size={:sm} variant={:outline}>
            {gettext("Back to %{page}", page: @back.label)}
          </.a>

          <.text
            aria-hidden="true"
            tag="h1"
            size={:header}
            variant={:secondary}
            class="truncate"
            id="page-title"
          >
            {@page_title}
          </.text>
        </header>
      </div>

      <section class="mx-auto p-4 sm:p-6">
        {render_slot(@inner_block)}
      </section>

      <.flash_group flash={@flash} />
    </main>
    """
  end
end
