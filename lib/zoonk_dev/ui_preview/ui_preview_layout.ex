defmodule ZoonkDev.UIPreview.UIPreviewLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :page_title, :string, required: true
  attr :active_page, :atom, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main aria-labelledby="page-title">
      <div class="bg-zk-surface/70 border-zk-border sticky top-0 z-50 border-b backdrop-blur-md">
        <header class="mx-auto flex items-center justify-between gap-4 p-4 md:p-6">
          <.a kind={:button} navigate={~p"/"} size={:sm} variant={:outline}>
            Back to app
          </.a>

          <.text
            aria-hidden="true"
            tag="h1"
            size={:xxl}
            variant={:secondary}
            class="truncate"
            id="page-title"
          >
            {@page_title}
          </.text>
        </header>
      </div>

      <nav class="bg-zk-background/70 sticky top-16 z-10 w-full backdrop-blur-md md:top-20">
        <ul class="scrollbar-none mx-auto flex items-center gap-2 overflow-x-auto p-4 md:p-6">
          <li
            :for={item <- menu_items()}
            class={[
              "shadow-xs rounded-lg px-2 py-1.5 leading-none tracking-tight",
              @active_page == item.module && "bg-zk-primary shadow-zk-primary",
              @active_page != item.module && "bg-zk-surface"
            ]}
          >
            <.link
              navigate={item.path}
              class={[
                "inline-flex items-center gap-1 align-middle",
                @active_page == item.module && "text-zk-primary-foreground"
              ]}
            >
              <.icon name={item.icon} class={["size-4", @active_page != item.module && item.color]} />
              <span class={["text-xs", @active_page != item.module && "text-zk-surface-foreground"]}>
                {item.label}
              </span>
            </.link>
          </li>
        </ul>
      </nav>

      <article class="zk-grid mx-auto px-4 pb-4 md:px-6 md:pb-6">
        {render_slot(@inner_block)}
      </article>
    </main>
    """
  end

  defp menu_items do
    [
      %{icon: "tabler-ufo", color: "text-slate-500", module: :home, label: "Home", path: "/ui"},
      %{icon: "tabler-link", color: "text-blue-500", module: :anchor, label: "Anchor", path: "/ui/anchor"},
      %{icon: "tabler-user-circle", color: "text-green-500", module: :avatar, label: "Avatar", path: "/ui/avatar"},
      %{icon: "tabler-pointer-filled", color: "text-red-500", module: :button, label: "Button", path: "/ui/button"},
      %{icon: "tabler-app-window-filled", color: "text-gray-500", module: :card, label: "Card", path: "/ui/card"},
      %{icon: "tabler-command", color: "text-indigo-500", module: :command, label: "Command", path: "/ui/command"},
      %{
        icon: "tabler-arrows-right-left",
        color: "text-yellow-500",
        module: :divider,
        label: "Divider",
        path: "/ui/divider"
      },
      %{icon: "tabler-bell-filled", color: "text-pink-500", module: :flash, label: "Flash", path: "/ui/flash"},
      %{icon: "tabler-forms", color: "text-purple-500", module: :form, label: "Form", path: "/ui/form"},
      %{icon: "tabler-cursor-text", color: "text-orange-500", module: :input, label: "Input", path: "/ui/input"},
      %{icon: "tabler-dots", color: "text-sky-500", module: :loader, label: "Loader", path: "/ui/loader"},
      %{icon: "tabler-typography", color: "text-teal-500", module: :text, label: "Text", path: "/ui/text"}
    ]
  end
end
