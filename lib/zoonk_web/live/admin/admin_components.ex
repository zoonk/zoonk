defmodule ZoonkWeb.Components.Admin do
  @moduledoc false
  use ZoonkWeb, :html

  def stats_card(assigns) do
    ~H"""
    <.card>
      <.card_content>
        <.text tag="h3" size={:caption} variant={:secondary}>{@title}</.text>
        <.text tag="span" size={:title} variant={:primary}>{@data}</.text>
      </.card_content>
    </.card>
    """
  end
end
