defmodule ZoonkWeb.Layouts do
  @moduledoc """
  This module holds different layouts used by your application.

  See the `layouts` directory for all templates available.
  The "root" layout is a skeleton rendered as part of the
  application router. The "app" layout is set as the default
  layout on both `use ZoonkWeb, :controller` and
  `use ZoonkWeb, :live_view`.
  """
  use ZoonkWeb, :html

  import ZoonkWeb.Components.Layout

  embed_templates "layouts/*"

  @doc """
  Get the user_return_to path.

  Some pages have a back button that returns to a specific app section.
  This function returns the path to that section based on the active page.
  """
  def user_return_to_path(:home), do: ~p"/"
  def user_return_to_path(:browse_goals), do: ~p"/goals"
  def user_return_to_path(:browse_catalog), do: ~p"/catalog"
  def user_return_to_path(:browse_library), do: ~p"/library"
  def user_return_to_path(_page), do: ~p"/"
end
