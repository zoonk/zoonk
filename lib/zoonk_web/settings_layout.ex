defmodule ZoonkWeb.SettingsLayout do
  @moduledoc false
  use ZoonkWeb, :html
  use Gettext, backend: Zoonk.Gettext

  alias Phoenix.LiveView.JS

  attr :scope, Zoonk.Scope, required: true
  attr :flash, :map, required: true
  attr :current_page, :atom, required: true
  attr :has_form, :boolean, default: false
  attr :save_label, :string, default: nil
  attr :display_success, :boolean, default: false
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main class="min-h-dvh flex flex-col">
      <header class="bg-zk-surface/70 border-zk-border sticky top-0 z-50 border-b backdrop-blur-md">
        <div class="flex items-center justify-between gap-4 p-4">
          <.a kind={:icon} navigate={~p"/"} size={:sm} variant={:outline} icon="tabler-x" aria-label={gettext("Close")}>
            {gettext("Close")}
          </.a>

          <div :if={assigns[:scope] && !assigns[:scope].user} class="flex items-center gap-2">
            <.a navigate={~p"/login"} size={:sm} variant={:outline}>
              {gettext("Login")}
            </.a>
          </div>

          <div :if={@has_form} class="flex items-center gap-3">
            <.text
              :if={@display_success}
              size={:sm}
              variant={:secondary}
              class="text-zk-success"
              phx-mounted={JS.transition({"ease-in-out duration-300", "opacity-0", "opacity-100"})}
            >
              {gettext("Done!")}
            </.text>

            <.button
              type="submit"
              form="settings_form"
              size={:sm}
              phx-disable
            >
              {@save_label || gettext("Save")}
            </.button>
          </div>
        </div>
      </header>

      <div class="flex flex-1">
        <nav class="bg-zk-surface border-zk-border w-64 border-r hidden md:block">
          <div class="p-4">
            <.text tag="h2" size={:lg} weight={:medium} class="mb-4">{gettext("Settings")}</.text>
            
            <ul class="space-y-1">
              <li :for={item <- menu_items()}>
                <.a
                  navigate={item.path}
                  kind={:link}
                  class={[
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    "hover:bg-zk-muted",
                    @current_page == item.key && "bg-zk-accent text-zk-accent-foreground font-medium",
                    @current_page != item.key && "text-zk-muted-foreground hover:text-zk-foreground"
                  ]}
                >
                  <.icon name={item.icon} size={:sm} />
                  <span class="hidden md:inline">{item.label}</span>
                </.a>
              </li>
            </ul>
          </div>
        </nav>

        <nav class="bg-zk-surface border-zk-border border-r md:hidden fixed bottom-0 left-0 right-0 z-40">
          <div class="flex justify-around py-2">
            <div :for={item <- menu_items()} class="flex flex-col items-center">
              <.a
                navigate={item.path}
                kind={:link}
                class={[
                  "flex flex-col items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                  @current_page == item.key && "text-zk-primary",
                  @current_page != item.key && "text-zk-muted-foreground"
                ]}
              >
                <.icon name={item.icon} size={:sm} />
                <span class="text-xs">{String.slice(item.label, 0..5)}</span>
              </.a>
            </div>
          </div>
        </nav>

        <div class="flex-1 p-4 pb-20 md:pb-4">
          {render_slot(@inner_block)}
        </div>
      </div>

      <.flash_group flash={@flash} />
    </main>
    """
  end

  defp menu_items do
    [
      %{key: :name, icon: "tabler-user", label: dgettext("settings", "Name"), path: ~p"/name"},
      %{key: :language, icon: "tabler-language", label: dgettext("settings", "Language"), path: ~p"/language"},
      %{key: :billing, icon: "tabler-credit-card", label: dgettext("settings", "Billing"), path: ~p"/billing"},
      %{key: :email, icon: "tabler-mail", label: dgettext("settings", "Email"), path: ~p"/email"},
      %{key: :feedback, icon: "tabler-message", label: dgettext("settings", "Feedback"), path: ~p"/feedback"},
      %{key: :support, icon: "tabler-help", label: dgettext("settings", "Support"), path: ~p"/support"},
      %{key: :follow, icon: "tabler-users", label: dgettext("settings", "Follow"), path: ~p"/follow"}
    ]
  end
end