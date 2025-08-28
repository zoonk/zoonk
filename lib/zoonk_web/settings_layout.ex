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
    <div class="h-dvh flex w-full">
      <aside class="h-dvh border-zk-border bg-zk-background sticky top-0 shrink-0 border-r md:w-64">
        <nav class="flex flex-col gap-1 p-2">
          <.settings_menu_item
            icon={menu_icon(:home)}
            label={dgettext("menu", "Home")}
            path={~p"/"}
            current_page={@current_page}
            page={:home}
          />

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
        </nav>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          :if={display_header?(assigns)}
          class="bg-zk-background/70 border-zk-border sticky top-0 z-50 flex items-center justify-end border-b px-4 py-2 backdrop-blur-md"
        >
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

        <main class="flex-1 overflow-y-auto p-4">
          {render_slot(@inner_block)}
        </main>

        <.flash_group flash={@flash} />
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
    <.link
      navigate={@path}
      aria-current={@current_page == @page && "page"}
      class={[
        "group relative flex h-9 select-none items-center gap-2 rounded-md px-3 text-sm outline-none ring-0 transition-colors",
        "hover:bg-zk-muted focus-visible:bg-zk-muted focus-visible:ring-zk-ring focus-visible:ring-2",
        @current_page == @page && "bg-zk-muted text-zk-primary-text",
        @current_page != @page && "text-zk-foreground/70 hover:text-zk-foreground"
      ]}
    >
      <.icon name={@icon} size={:sm} class="opacity-90 group-hover:opacity-100" />
      <span class="sr-only md:not-sr-only md:truncate">{@label}</span>
      <span class={[
        "bg-zk-primary pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full opacity-0 transition-opacity",
        @current_page == @page && "opacity-100"
      ]} />
    </.link>
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

  defp display_header?(assigns) do
    assigns.has_form || is_nil(assigns.scope.user)
  end
end
