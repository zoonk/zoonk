defmodule ZoonkWeb.SettingsLayout do
  @moduledoc false
  use ZoonkWeb, :html
  use Gettext, backend: Zoonk.Gettext

  attr :scope, Zoonk.Scope, required: true
  attr :flash, :map, required: true
  attr :current_page, :atom, required: true
  attr :has_form, :boolean, default: false
  attr :save_label, :string, default: nil
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main class="min-h-dvh flex flex-col">
      <!-- Header -->
      <header class="bg-zk-surface/70 border-zk-border sticky top-0 z-50 border-b backdrop-blur-md">
        <div class="flex items-center justify-between gap-4 p-4">
          <!-- Close link -->
          <.a kind={:button} navigate={~p"/"} size={:sm} variant={:outline} icon="tabler-x">
            Close
          </.a>

          <!-- Save button (only for forms) -->
          <.button
            :if={@has_form}
            type="submit"
            form="settings_form"
            size={:sm}
            phx-disable
          >
            {@save_label || "Save"}
          </.button>
        </div>
      </header>

      <!-- Two-column layout -->
      <div class="flex flex-1">
        <!-- Left sidebar menu -->
        <nav class="bg-zk-surface border-zk-border w-64 border-r">
          <div class="p-4">
            <.text tag="h2" size={:lg} weight={:medium} class="mb-4">Settings</.text>
            
            <ul class="space-y-1">
              <li :for={item <- menu_items()}>
                <.a
                  navigate={item.path}
                  kind={:link}
                  class={[
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "hover:bg-zk-muted",
                    @current_page == item.key && "bg-zk-primary text-zk-primary-foreground",
                    @current_page != item.key && "text-zk-foreground"
                  ]}
                >
                  <.icon name={item.icon} size={:sm} />
                  {item.label}
                </.a>
              </li>
            </ul>
          </div>
        </nav>

        <!-- Main content area -->
        <div class="flex-1 p-4">
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