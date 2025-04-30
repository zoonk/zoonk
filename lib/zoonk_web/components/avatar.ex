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
  attr :src, :string, default: nil, doc: "URL of the avatar image"

  attr :alt, :string,
    required: true,
    doc: "Alt text for the avatar image - also used as a placeholder if no image is provided"

  attr :size, :atom, values: [:xs, :sm, :md, :lg], default: :sm
  attr :class, :any, default: nil

  # handles the case where the image is not available
  def avatar(%{src: nil} = assigns) do
    ~H"""
    <span
      class={[
        "flex flex-col items-center justify-center font-extrabold uppercase",
        "bg-zk-secondary text-zk-secondary-foreground",
        shared_class(),
        avatar_size(@size),
        @class
      ]}
      aria-hidden="true"
    >
      {avatar_label(@alt)}
    </span>
    """
  end

  # handles the case where the image is available
  def avatar(assigns) do
    ~H"""
    <img
      width={avatar_size_px(@size)}
      height={avatar_size_px(@size)}
      class={["aspect-square", avatar_size(@size), shared_class(), @class]}
      src={@src}
      alt={@alt}
    />
    """
  end

  defp shared_class, do: ["shrink-0 zk-shadow-border rounded-full"]

  defp avatar_size(:xs), do: "size-6 text-sm"
  defp avatar_size(:sm), do: "size-8 text-md"
  defp avatar_size(:md), do: "size-10 text-lg"
  defp avatar_size(:lg), do: "size-16 text-2xl"

  defp avatar_size_px(:xs), do: "24px"
  defp avatar_size_px(:sm), do: "38px"
  defp avatar_size_px(:md), do: "40px"
  defp avatar_size_px(:lg), do: "64px"

  defp avatar_label(label) when is_binary(label), do: String.first(label)
  defp avatar_label(label), do: label
end
