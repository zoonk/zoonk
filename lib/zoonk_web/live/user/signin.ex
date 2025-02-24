defmodule ZoonkWeb.Live.UserSignIn do
  @moduledoc false
  use ZoonkWeb, :live_view

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      user login
    </div>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, socket}
  end
end
