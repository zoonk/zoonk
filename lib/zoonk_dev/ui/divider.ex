defmodule ZoonkDev.Live.UIDivider do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="zk-grid">
      <.card>
        <.card_header>
          <.card_title>Basic Divider</.card_title>
          <.card_description>
            A simple divider with a label to separate content sections.
          </.card_description>
        </.card_header>

        <.card_content class="flex flex-col items-center justify-center gap-4">
          <.text>Content above the divider</.text>
          <.divider label="Or continue with" />
          <.text>Content below the divider</.text>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Custom Styled Divider</.card_title>
          <.card_description>
            Dividers can be customized with additional classes.
          </.card_description>
        </.card_header>

        <.card_content class="flex flex-col items-center justify-center gap-4">
          <.text>First content section</.text>
          <.divider label="Custom divider" class="my-8" />
          <.text>Second content section</.text>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Divider Usage</.card_title>
          <.card_description>
            Common usage examples for dividers in forms and authentication flows.
          </.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.button variant={:primary} class="w-full">Sign in with Email</.button>
          <.divider label="Or continue with" />
          <div class="grid grid-cols-2 gap-4">
            <.button variant={:outline} icon="tabler-brand-google-filled">Google</.button>
            <.button variant={:outline} icon="tabler-brand-github-filled">GitHub</.button>
          </div>
        </.card_content>
      </.card>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Divider")
    {:ok, socket}
  end
end
