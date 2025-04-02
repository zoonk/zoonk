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
      <.menu>
        <.menu_group primary>
          <.menu_item :for={item <- get_menu_items(:main)} primary {item} />
        </.menu_group>

        <.menu_group heading={gettext("Account")}>
          <.menu_item
            :for={item <- get_menu_items(:user)}
            active={item.active == @active_page}
            {item}
          />
        </.menu_group>
      </.menu>

      <div class="bg-zk-background flex-1">
        <.header page_title={@page_title} scope={@scope} />

        <section class="p-4">
          {render_slot(@inner_block)}
        </section>
      </div>

      <.flash_group flash={@flash} />
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
        navigate: ~p"/user/email",
        active: :email,
        icon: "tabler-mail",
        label: gettext("Email")
      },
      %{
        navigate: ~p"/user/interests",
        active: :interests,
        icon: "tabler-star",
        label: gettext("Interests")
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
