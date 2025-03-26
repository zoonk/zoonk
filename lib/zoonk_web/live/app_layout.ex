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
          <.sidebar_menu_item
            :for={item <- get_menu_items(:main)}
            active={item.active == @active_page}
            {item}
          >
            {item.label}
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu heading={gettext("Management")}>
          <.sidebar_menu_item :for={item <- get_menu_items(:management)} {item}>
            {item.label}
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu heading={gettext("Settings")}>
          <.sidebar_menu_item
            :for={item <- get_menu_items(:settings)}
            active={item.active == @active_page}
            {item}
          >
            {item.label}
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

  defp get_menu_items(:main) do
    [
      %{
        navigate: ~p"/",
        active: :home,
        icon: "tabler-brain",
        label: gettext("Summary")
      },
      %{
        navigate: ~p"/goals",
        active: :goals,
        icon: "tabler-target-arrow",
        label: gettext("Goals")
      },
      %{
        navigate: ~p"/catalog",
        active: :catalog,
        icon: "tabler-layout-grid",
        label: gettext("Catalog")
      },
      %{
        navigate: ~p"/library",
        active: :library,
        icon: "tabler-stack-2",
        label: gettext("Library")
      }
    ]
  end

  defp get_menu_items(:management) do
    [
      %{
        navigate: ~p"/editor",
        icon: "tabler-edit",
        label: gettext("Editor")
      },
      %{
        navigate: ~p"/org",
        icon: "tabler-building",
        label: gettext("Organization")
      }
    ]
  end

  defp get_menu_items(:settings) do
    [
      %{
        navigate: ~p"/user/interests",
        active: :user_interests,
        icon: "tabler-star",
        label: gettext("Interests")
      },
      %{
        navigate: ~p"/user/email",
        active: :user_email,
        icon: "tabler-mail",
        label: gettext("Email")
      },
      %{
        navigate: ~p"/user/billing",
        active: :user_billing,
        icon: "tabler-credit-card",
        label: gettext("Billing")
      },
      %{
        href: ~p"/logout",
        method: "delete",
        active: false,
        icon: "tabler-logout",
        destructive: true,
        label: gettext("Logout")
      }
    ]
  end
end
