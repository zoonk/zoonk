defmodule ZoonkWeb.AppLayout do
  @moduledoc false
  use ZoonkWeb, :html

  alias Zoonk.Accounts.User
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Scope

  attr :page_title, :string, required: true
  attr :scope, Zoonk.Scope, required: true
  attr :flash, :map, required: true
  attr :active_page, :atom, required: true
  slot :inner_block, required: true

  def render(assigns) do
    ~H"""
    <main class="pb-16 md:pb-0 lg:flex">
      <.menu>
        <.menu_group primary>
          <.menu_item
            :for={item <- get_menu_items(:main)}
            :if={visible?(item.visible, @scope)}
            active={item.active == @active_page}
            primary
            {item}
          />
        </.menu_group>

        <.menu_group heading={gettext("Account")}>
          <.menu_item
            :for={item <- get_menu_items(:account)}
            :if={visible?(item.visible, @scope)}
            {item}
          />
        </.menu_group>
      </.menu>

      <div class="bg-zk-background flex-1">
        <.header page_title={@page_title} scope={@scope}>
          <.a :if={!@scope.user} kind={:button} variant={:outline} href={~p"/login"}>
            {gettext("Login")}
          </.a>
        </.header>

        <.link :if={@scope.user} navigate={~p"/user/email"} class="fixed top-4 right-4 z-50">
          <span class="sr-only">{gettext("Go to settings")}</span>
          <.avatar src={@scope.user.profile.picture_url} size={:md} alt={gettext("Profile Picture")} />
        </.link>

        {render_slot(@inner_block)}
      </div>

      <.flash_group flash={@flash} />
    </main>
    """
  end

  defp get_menu_items(:main) do
    [
      %{
        navigate: ~p"/",
        active: :home,
        icon: "tabler-brain",
        label: gettext("Summary"),
        visible: :member
      },
      %{
        navigate: ~p"/goals",
        active: :goals,
        icon: "tabler-target-arrow",
        label: gettext("Goals"),
        visible: :member
      },
      %{
        navigate: ~p"/catalog",
        active: :catalog,
        icon: "tabler-layout-grid",
        label: gettext("Catalog"),
        visible: :public
      },
      %{
        navigate: ~p"/library",
        active: :library,
        icon: "tabler-stack-2",
        label: gettext("Library"),
        visible: :member
      }
    ]
  end

  defp get_menu_items(:account) do
    [
      %{
        navigate: ~p"/user/email",
        icon: "tabler-settings",
        label: gettext("Settings"),
        visible: :member
      },
      %{
        navigate: ~p"/login",
        icon: "tabler-login",
        label: gettext("Login"),
        visible: :non_authenticated
      },
      %{
        navigate: ~p"/signup",
        icon: "tabler-user-plus",
        label: gettext("Sign Up"),
        visible: :non_authenticated
      },
      %{
        navigate: ~p"/editor",
        icon: "tabler-edit",
        label: gettext("Editor"),
        visible: :admin
      },
      %{
        navigate: ~p"/org",
        icon: "tabler-building",
        label: gettext("Organization"),
        visible: :admin
      },
      %{
        href: ~p"/logout",
        method: "delete",
        active: false,
        icon: "tabler-logout",
        destructive: true,
        label: gettext("Logout"),
        visible: :member
      }
    ]
  end

  defp visible?(:non_authenticated, %Scope{user: nil}), do: true
  defp visible?(:non_authenticated, %Scope{user: %User{}}), do: false
  defp visible?(:public, _scope), do: true
  defp visible?(:member, %Scope{user: %User{kind: :regular}}), do: true
  defp visible?(:member, _scope), do: false
  defp visible?(:admin, %Scope{org_member: %OrgMember{role: :admin}}), do: true
  defp visible?(:admin, _scope), do: false
end
