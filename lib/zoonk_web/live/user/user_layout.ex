defmodule ZoonkWeb.UserLayout do
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
          <.sidebar_menu_item :for={item <- get_menu_items(:main)} {item}>
            {item.label}
          </.sidebar_menu_item>
        </.sidebar_menu>

        <.sidebar_menu heading={gettext("Account")}>
          <.sidebar_menu_item
            :for={item <- get_menu_items(:user)}
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
        icon: "tabler-brain",
        label: gettext("Back to app")
      }
    ]
  end

  defp get_menu_items(:user) do
    [
      %{
        navigate: ~p"/user/interests",
        active: :interests,
        icon: "tabler-star",
        label: gettext("Interests")
      },
      %{
        navigate: ~p"/user/email",
        active: :email,
        icon: "tabler-mail",
        label: gettext("Email")
      },
      %{
        navigate: ~p"/user/billing",
        active: :billing,
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
