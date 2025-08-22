defmodule ZoonkWeb.SettingsLayout do
  @moduledoc """
  Settings layout component providing a two-column layout for settings pages.
  """
  use ZoonkWeb, :html

  attr :scope, Zoonk.Scope, required: true
  attr :flash, :map, required: true
  attr :current_page, :atom, required: true
  attr :has_form, :boolean, default: false
  attr :form_id, :string, default: nil
  attr :save_label, :string, default: nil
  attr :display_success, :boolean, default: false

  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <div class="min-h-dvh flex flex-col">
      <header class="border-zk-border bg-zk-background/70 sticky top-0 z-50 flex items-center justify-between border-b p-4 backdrop-blur-md">
        <.a kind={:icon} icon={menu_icon(:close)} variant={:outline} navigate={~p"/"} size={:sm}>
          {dgettext("menu", "Close settings")}
        </.a>

        <div class="flex items-center gap-3">
          <.text
            :if={@display_success}
            size={:sm}
            variant={:custom}
            class="text-zk-success-text"
            phx-mounted={JS.transition({"ease-in-out duration-300", "opacity-0", "opacity-100"})}
          >
            {dgettext("settings", "Done!")}
          </.text>

          <.a
            :if={is_nil(@scope.user)}
            kind={:button}
            variant={:outline}
            navigate={~p"/login"}
            size={:sm}
          >
            {dgettext("menu", "Login")}
          </.a>

          <.button :if={@has_form} type="submit" size={:sm} form={@form_id} phx-disable>
            {@save_label || dgettext("settings", "Save")}
          </.button>
        </div>
      </header>

      <div class="flex flex-1">
        <aside class="border-zk-border bg-zk-background fixed top-16 bottom-0 left-0 z-40 overflow-y-auto border-r md:w-64">
          <nav>
            <ul class="flex flex-col">
              <.settings_menu_item
                icon={menu_icon(:settings)}
                label={dgettext("menu", "Settings")}
                path={~p"/settings"}
                current_page={@current_page}
                page={:settings}
              />

              <.settings_menu_item
                :for={item <- menu_items()}
                icon={item.icon}
                label={item.label}
                path={item.path}
                current_page={@current_page}
                page={item.page}
              />
            </ul>
          </nav>
        </aside>

        <main class="ml-13 flex-1 p-4 md:ml-64">
          {render_slot(@inner_block)}
          <.flash_group flash={@flash} />
        </main>
      </div>
    </div>
    """
  end

  attr :icon, :string, required: true
  attr :label, :string, required: true
  attr :path, :string, required: true
  attr :current_page, :atom, required: true
  attr :page, :atom, required: true

  defp settings_menu_item(assigns) do
    ~H"""
    <li>
      <.link
        navigate={@path}
        class={[
          "flex items-center gap-3 p-4 transition-colors",
          "select-none hover:bg-zk-muted focus-visible:bg-zk-muted focus-visible:outline-0",
          @current_page == @page && "bg-zk-muted text-zk-primary-text",
          @current_page != @page && "text-zk-foreground/70"
        ]}
      >
        <.icon name={@icon} size={:sm} />
        <span class="sr-only md:not-sr-only">{@label}</span>
      </.link>
    </li>
    """
  end

  def menu_items do
    [
      %{icon: menu_icon(:interests), label: dgettext("menu", "Your interests"), path: ~p"/interests", page: :interests},
      %{
        icon: menu_icon(:subscription),
        label: dgettext("menu", "Subscription"),
        path: ~p"/subscription",
        page: :subscription
      },
      %{icon: menu_icon(:display_name), label: dgettext("menu", "Display name"), path: ~p"/name", page: :name},
      %{icon: menu_icon(:language), label: dgettext("menu", "App language"), path: ~p"/language", page: :language},
      %{icon: menu_icon(:email), label: dgettext("menu", "Change email"), path: ~p"/email", page: :email},
      %{icon: menu_icon(:contact), label: dgettext("menu", "Contact us"), path: ~p"/contact", page: :contact},
      %{icon: menu_icon(:follow_us), label: dgettext("menu", "Follow us"), path: ~p"/follow", page: :follow}
    ]
  end
end
