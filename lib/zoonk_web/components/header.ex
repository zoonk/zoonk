defmodule ZoonkWeb.Components.Header do
  @moduledoc """
  Header component for displaying page titles and optional navigation elements.
  """
  use Phoenix.Component

  @doc """
  Renders the header component.

  ## Example

      <.header page_title="My Page" scope={@scope}>
        <.a navigate={~p"/settings"}>Settings</.a>
      </.header>
  """
  attr :page_title, :string, required: true, doc: "Title of the page"
  attr :scope, Zoonk.Scope, required: true, doc: "App scope"
  slot :inner_block, doc: "Content to be rendered inside the header"

  def header(assigns) do
    ~H"""
    <header
      id="page-header"
      phx-hook="ToolbarScroll"
      data-scrolled="false"
      class={[
        "flex w-full items-center justify-between",
        "sticky top-0 p-4",
        "bg-transparent backdrop-blur-lg",
        "data-[scrolled=true]:bg-zk-secondary/80"
      ]}
    >
      <h1 class="text-3xl font-bold">{@page_title}</h1>
      {render_slot(@inner_block)}
    </header>
    """
  end
end
