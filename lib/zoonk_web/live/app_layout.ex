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
    <main aria-labelledby="page-title pb-24">
      <header
        aria-label={gettext("Search and settings")}
        class="mx-auto flex max-w-3xl items-center justify-between p-4 sm:p-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14"
      >
        <.text tag="h1" size={:header} id="page-title">{@page_title}</.text>

        <.link
          navigate={~p"/user/email?redirect_to=#{user_return_to_path(@active_page)}"}
          aria-label={dgettext("users", "Go to user settings")}
        >
          <.avatar
            src={@scope.user.profile.picture_url}
            alt={Zoonk.Accounts.User.get_display_name(@scope.user.profile)}
          />
        </.link>
      </header>

      {render_slot(@inner_block)}

      <.flash_group flash={@flash} />
    </main>
    """
  end

  defp user_return_to_path(:home), do: ~p"/"
  defp user_return_to_path(:goals), do: ~p"/goals"
  defp user_return_to_path(:catalog), do: ~p"/catalog"
  defp user_return_to_path(:library), do: ~p"/library"
  defp user_return_to_path(_page), do: ~p"/"
end
