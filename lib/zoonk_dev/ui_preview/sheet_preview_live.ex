defmodule ZoonkDev.UIPreview.SheetPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:sheet} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Sheet - Bottom</.card_title>
          <.card_description>A sheet that slides in from the bottom of the screen.</.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.button phx-click={JS.show(to: "#bottom-sheet")}>
            Open Bottom Sheet
          </.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Sheet - Top</.card_title>
          <.card_description>A sheet that slides in from the top of the screen.</.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.button phx-click={JS.show(to: "#top-sheet")}>
            Open Top Sheet
          </.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Sheet - Left</.card_title>
          <.card_description>
            A sheet that slides in from the left side of the screen.
          </.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.button phx-click={JS.show(to: "#left-sheet")}>
            Open Left Sheet
          </.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Sheet - Right</.card_title>
          <.card_description>
            A sheet that slides in from the right side of the screen.
          </.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.button phx-click={JS.show(to: "#right-sheet")}>
            Open Right Sheet
          </.button>
        </.card_content>
      </.card>
      
    <!-- Bottom Sheet -->
      <.sheet id="bottom-sheet" position={:bottom}>
        <.sheet_header>
          <.sheet_title>Bottom Sheet</.sheet_title>
          <.sheet_description>This sheet slides in from the bottom.</.sheet_description>
        </.sheet_header>
        <.sheet_content>
          <.text>
            This is a bottom sheet that slides up from the bottom of the screen.
            It's perfect for mobile-first designs and quick actions.
          </.text>
          <div class="mt-4 space-y-4">
            <.text variant={:secondary}>
              Here's some additional content to show scrolling behavior when the content is longer than the available space.
            </.text>
            <.text variant={:secondary}>Bottom sheets are commonly used for:</.text>
            <ul class="ml-4 list-disc space-y-2">
              <li>
                <.text size={:sm}>Action menus</.text>
              </li>
              <li>
                <.text size={:sm}>Settings panels</.text>
              </li>
              <li>
                <.text size={:sm}>Filter options</.text>
              </li>
              <li>
                <.text size={:sm}>Contact forms</.text>
              </li>
            </ul>
          </div>
        </.sheet_content>
        <.sheet_footer>
          <.button variant={:outline} phx-click={JS.hide(to: "#bottom-sheet")}>Cancel</.button>
          <.button phx-click={JS.hide(to: "#bottom-sheet")}>Save Changes</.button>
        </.sheet_footer>
      </.sheet>
      
    <!-- Top Sheet -->
      <.sheet id="top-sheet" position={:top}>
        <.sheet_header>
          <.sheet_title>Top Sheet</.sheet_title>
          <.sheet_description>This sheet slides in from the top.</.sheet_description>
        </.sheet_header>
        <.sheet_content>
          <.text>
            This is a top sheet that slides down from the top of the screen.
            It's useful for notifications or important announcements.
          </.text>
        </.sheet_content>
      </.sheet>
      
    <!-- Left Sheet -->
      <.sheet id="left-sheet" position={:left}>
        <.sheet_header>
          <.sheet_title>Left Sheet</.sheet_title>
          <.sheet_description>This sheet slides in from the left.</.sheet_description>
        </.sheet_header>
        <.sheet_content>
          <.text>
            This is a left sheet that slides in from the left side of the screen.
            Perfect for navigation menus or sidebar content.
          </.text>
          <nav class="mt-4">
            <.text tag="h4" size={:sm} variant={:primary}>Navigation Menu</.text>
            <ul class="mt-2 space-y-2">
              <li>
                <.a href="#" class="block rounded p-2 hover:bg-zk-muted">Dashboard</.a>
              </li>
              <li>
                <.a href="#" class="block rounded p-2 hover:bg-zk-muted">Settings</.a>
              </li>
              <li>
                <.a href="#" class="block rounded p-2 hover:bg-zk-muted">Profile</.a>
              </li>
              <li>
                <.a href="#" class="block rounded p-2 hover:bg-zk-muted">Help</.a>
              </li>
            </ul>
          </nav>
        </.sheet_content>
      </.sheet>
      
    <!-- Right Sheet -->
      <.sheet id="right-sheet" position={:right}>
        <.sheet_header>
          <.sheet_title>Right Sheet</.sheet_title>
          <.sheet_description>This sheet slides in from the right.</.sheet_description>
        </.sheet_header>
        <.sheet_content>
          <.text>
            This is a right sheet that slides in from the right side of the screen.
            Commonly used for detailed views or secondary content.
          </.text>
          <div class="mt-4">
            <.text tag="h4" size={:sm} variant={:primary}>User Details</.text>
            <div class="mt-2 space-y-2">
              <div class="flex justify-between">
                <.text size={:sm} variant={:secondary}>Name:</.text>
                <.text size={:sm}>John Doe</.text>
              </div>
              <div class="flex justify-between">
                <.text size={:sm} variant={:secondary}>Email:</.text>
                <.text size={:sm}>john@example.com</.text>
              </div>
              <div class="flex justify-between">
                <.text size={:sm} variant={:secondary}>Role:</.text>
                <.text size={:sm}>Administrator</.text>
              </div>
            </div>
          </div>
        </.sheet_content>
        <.sheet_footer>
          <.button variant={:outline} phx-click={JS.hide(to: "#right-sheet")}>Close</.button>
          <.button phx-click={JS.hide(to: "#right-sheet")}>Edit User</.button>
        </.sheet_footer>
      </.sheet>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Sheet")
    {:ok, socket}
  end
end
