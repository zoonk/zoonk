defmodule ZoonkWeb.Components.DataList do
  @moduledoc """
  Provides the UI for rendering data lists.
  """
  use Phoenix.Component

  @doc """
  Renders a data list.

  ## Examples

      <.list>
        <:item title="Title">{@post.title}</:item>
        <:item title="Views">{@post.views}</:item>
      </.list>
  """
  slot :item, required: true do
    attr :title, :string, required: true
  end

  def list(assigns) do
    ~H"""
    <div>
      <dl>
        <div :for={item <- @item}>
          <dt>{item.title}</dt>
          <dd>{render_slot(item)}</dd>
        </div>
      </dl>
    </div>
    """
  end
end
