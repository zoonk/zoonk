defmodule ZoonkDev.UIPreview.AccordionPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:accordion} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Basic Accordion</.card_title>
          <.card_description>
            Simple accordion using native HTML details/summary elements.
          </.card_description>
        </.card_header>

        <.card_content>
          <.accordion title="What is Zoonk?">
            Zoonk is an educational platform designed to make learning accessible and engaging for everyone.
            Our mission is to democratize education through innovative technology and community-driven content.
          </.accordion>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Multiple Accordions</.card_title>
          <.card_description>
            Stack multiple accordions to create FAQ sections or organized content.
          </.card_description>
        </.card_header>

        <.card_content>
          <.accordion title="Getting Started">
            To get started with Zoonk, simply create an account and explore our vast library of courses.
            You can start with beginner-friendly content and progress at your own pace.
          </.accordion>

          <.accordion title="Advanced Features">
            <div class="space-y-2">
              <p>Zoonk offers several advanced features:</p>
              <ul class="list-inside list-disc space-y-1">
                <li>Interactive learning paths</li>
                <li>Community discussions</li>
                <li>Progress tracking</li>
                <li>Custom content creation</li>
              </ul>
            </div>
          </.accordion>

          <.accordion title="Support & Help">
            Need help? Our support team is available 24/7 to assist you with any questions or issues.
            You can also browse our comprehensive FAQ section or join our community forums.
          </.accordion>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Open by Default</.card_title>
          <.card_description>
            Accordions can be expanded by default using the `open` attribute.
          </.card_description>
        </.card_header>

        <.card_content>
          <.accordion title="This accordion is open by default" open>
            This accordion demonstrates the `open` attribute, which makes the accordion expanded by default.
            Users can still collapse it by clicking the summary.
          </.accordion>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Rich Content</.card_title>
          <.card_description>
            Accordions can contain any type of content including complex layouts.
          </.card_description>
        </.card_header>

        <.card_content>
          <.accordion title="Rich Content Example">
            <div class="space-y-3">
              <p>
                This accordion contains more complex content including multiple paragraphs and elements.
              </p>

              <div class="font-mono rounded bg-gray-50 p-3 text-sm">
                npm install @zoonk/ui
              </div>

              <p>
                You can include any type of content inside an accordion, making it very flexible for
                different use cases like FAQs, settings panels, or content organization.
              </p>
            </div>
          </.accordion>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Accordion")
    {:ok, socket}
  end
end
