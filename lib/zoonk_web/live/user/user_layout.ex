defmodule ZoonkWeb.User.UserLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :page_title, :string, required: true
  attr :flash, :map, required: true
  attr :active_page, :atom, required: true
  attr :user_return_to, :string, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main aria-labelledby="page-title">
      <.tab_bar>
        <.nav_menu_item
          active={@active_page == :email}
          label={dgettext("users", "Email")}
          icon="tabler-mail"
          navigate={~p"/user/email?redirect_to=#{@user_return_to}"}
        />

        <.nav_menu_item
          label={dgettext("users", "Logout")}
          icon="tabler-logout"
          method="delete"
          href={~p"/logout"}
          destructive
        />
      </.tab_bar>

      <div class="bg-zk-surface border-zk-border border-b">
        <header
          aria-label={gettext("Go back to the previous page")}
          class="mx-auto flex max-w-2xl items-center justify-between p-4 sm:p-6"
        >
          <.text aria-hidden="true" tag="h1" size={:header} id="page-title">{@page_title}</.text>

          <.a
            kind={:icon}
            icon="tabler-x"
            size={:sm}
            navigate={@user_return_to}
            variant={:destructive}
          >
            <span class="sr-only">{gettext("Back")}</span>
          </.a>
        </header>
      </div>

      <section aria-label={gettext("Update this form")} class="mx-auto max-w-2xl p-4 sm:p-6">
        {render_slot(@inner_block)}
      </section>

      <.flash_group flash={@flash} />
    </main>
    """
  end
end
