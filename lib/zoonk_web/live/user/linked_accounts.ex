defmodule ZoonkWeb.Live.UserLinkedAccounts do
  @moduledoc false
  use ZoonkWeb, :live_view

  def render(assigns) do
    ~H"""
    <div>
      linked accounts
    </div>
    """
  end

  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: dgettext("users", "Linked Accounts"))
    {:ok, socket, layout: {ZoonkWeb.Layouts, :user_settings}}
  end
end
