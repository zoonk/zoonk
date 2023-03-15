defmodule ZoonkWeb.Components.User do
  @moduledoc """
  Reusable components for user pages.
  """
  use ZoonkWeb, :html

  @doc """
  Renders a container for the authentication page.
  """
  slot :inner_block, required: true

  def auth_container(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <%= render_slot(@inner_block) %>
    </div>
    """
  end

  @doc """
  Renders a header for the authentication pages.
  """
  slot :inner_block, required: true
  slot :description

  def auth_header(assigns) do
    ~H"""
    <.header class="text-center mb-10">
      <%= render_slot(@inner_block) %>

      <:subtitle :if={@description != []}>
        <%= render_slot(@description) %>
      </:subtitle>
    </.header>
    """
  end

  @doc """
  Renders register / login links.
  """
  def auth_links(assigns) do
    ~H"""
    <p class="text-center mt-4 text-sm">
      <.link_styled navigate={~p"/users/register"} color={:black}>
        <%= dgettext("auth", "Register") %>
      </.link_styled>
      |
      <.link_styled navigate={~p"/users/log_in"} color={:black}>
        <%= dgettext("auth", "Log in") %>
      </.link_styled>
    </p>
    """
  end
end
