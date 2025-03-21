defmodule ZoonkWeb.Components.Avatar do
  @moduledoc """
  UI component for rendering avatars.
  """
  use Phoenix.Component

  @doc """
  Renders an avatar.

  It can use an image or a placeholder if no image is provided.

  ## Examples

      # Using an image
      <.avatar src="https://example.com/avatar.png" alt="Leo da Vinci" />

      # Using a placeholder, no src provided or nil
      <.avatar alt="Leo Da Vinci" />
  """
  attr :src, :string, default: nil
  attr :alt, :string, required: true
  attr :label, :string, required: true
  attr :size, :atom, values: [:sm, :md, :lg], default: :sm
  attr :class, :string, default: nil

  # handles the case where the image is not available
  def avatar(%{src: nil} = assigns) do
    ~H"""
    <span aria-label={@alt}>
      {avatar_label(@label)}
    </span>
    """
  end

  # handles the case where the image is available
  def avatar(assigns) do
    ~H"""
    <img width={avatar_size_px(@size)} height={avatar_size_px(@size)} src={@src} alt={@alt} />
    """
  end

  defp avatar_size(:sm), do: "size-8"
  defp avatar_size(:md), do: "size-12"
  defp avatar_size(:lg), do: "size-16"

  defp avatar_size_px(:sm), do: "38px"
  defp avatar_size_px(:md), do: "48px"
  defp avatar_size_px(:lg), do: "64px"

  defp avatar_label(label) when is_binary(label), do: String.first(label)
  defp avatar_label(label), do: label
end
