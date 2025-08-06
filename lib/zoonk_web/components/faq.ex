defmodule ZoonkWeb.Components.FAQ do
  @moduledoc """
  FAQ components for displaying frequently asked questions.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Accordion
  import ZoonkWeb.Components.Text

  alias Zoonk.Support

  @doc """
  Renders the FAQ header with title and subtitle.

  ## Example

      <.faq_header
        title="Frequently Asked Questions"
        subtitle="Common questions and answers about using Zoonk"
      />
  """
  attr :title, :string, required: true
  attr :subtitle, :string, required: true
  attr :class, :string, default: ""

  def faq_header(assigns) do
    ~H"""
    <div class={["mb-8", @class]}>
      <.text tag="h2" size={:xl} weight={:semibold} class="mb-2">{@title}</.text>
      <.text variant={:secondary} size={:sm}>{@subtitle}</.text>
    </div>
    """
  end

  @doc """
  Renders a single FAQ item with question and answer using an accordion.

  ## Example

      <.faq_item question="What is Zoonk?">
        Zoonk is an educational platform that helps you learn...
      </.faq_item>
  """
  attr :question, :string, required: true
  attr :class, :string, default: ""
  slot :inner_block, required: true

  def faq_item(assigns) do
    ~H"""
    <.accordion title={@question} class={@class}>
      {render_slot(@inner_block)}
    </.accordion>
    """
  end

  @doc """
  Renders general FAQ items.

  ## Example

      <.faq_general />
      <.faq_general title="General Questions" />
  """
  attr :class, :string, default: ""
  attr :title, :string, default: nil

  def faq_general(assigns) do
    ~H"""
    <div class={@class}>
      <.text :if={@title} tag="h3" size={:lg} weight={:semibold} class="text-zk-foreground mb-4">
        {@title}
      </.text>

      <.faq_item question={dgettext("faq", "I still have questions. How can I contact you?")}>
        {dgettext(
          "faq",
          "We'll get back to you within %{days} business days. You can reach us by filling the support form or by emailing %{email}.",
          days: Support.response_time_days(),
          email: Support.support_email()
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "Can I use Zoonk at my company?")}>
        {dgettext(
          "faq",
          "We're developing a white-label version for organizations and schools. If you're interested in early access, email us at %{email} with details about your use case.",
          email: Support.support_email()
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "Can I get a discount?")}>
        {dgettext(
          "faq",
          "We offer a discount on yearly payments. Other discounts aren't available right now, but if you have a special case, email us at %{email}.",
          email: Support.billing_email()
        )}
      </.faq_item>
    </div>
    """
  end

  @doc """
  Renders billing and subscription related FAQ items.

  ## Example

      <.faq_subscriptions />
      <.faq_subscriptions title="Subscriptions & Billing" />
  """
  attr :class, :string, default: ""
  attr :title, :string, default: nil

  def faq_subscriptions(assigns) do
    ~H"""
    <div class={@class}>
      <.text :if={@title} tag="h3" size={:lg} weight={:semibold} class="text-zk-foreground mb-4">
        {@title}
      </.text>

      <.faq_item question={dgettext("faq", "I have questions about billing or my subscription")}>
        {dgettext(
          "faq",
          "For billing-related questions, refunds, or subscription changes, please email us directly at %{billing_email} or use our contact form. We'll respond within %{days} business days.",
          billing_email: Support.billing_email(),
          days: Support.response_time_days()
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "How do I cancel my subscription?")}>
        {dgettext(
          "faq",
          "You can cancel anytime from your account settings or by emailing us at %{email}.",
          email: Support.billing_email()
        )}

        {dgettext(
          "faq",
          "On the home page, click on your profile picture in the top right corner, then select 'Subscription'. From there, select the 'Free' plan and click on 'Cancel Subscription'."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "Can I get a refund?")}>
        {dgettext(
          "faq",
          "Yes. Email %{email} and we'll work with you to find the best solution. Refunds are usually processed quickly if you haven't used Zoonk for more than 30 days or in case of errors.",
          email: Support.billing_email()
        )}
        <br /><br />
        {dgettext(
          "faq",
          "Note: We can only refund purchases made on our website; for App Store or Play Store purchases, request a refund through them."
        )}
      </.faq_item>
    </div>
    """
  end

  @doc """
  Renders feature-related FAQ items.

  ## Example

      <.faq_features />
      <.faq_features title="Features" />
  """
  attr :class, :string, default: ""
  attr :title, :string, default: nil

  def faq_features(assigns) do
    ~H"""
    <div class={@class}>
      <.text :if={@title} tag="h3" size={:lg} weight={:semibold} class="text-zk-foreground mb-4">
        {@title}
      </.text>
      <.faq_item question={dgettext("faq", "What are personalized reviews?")}>
        {dgettext(
          "faq",
          "Personalized reviews are AI-generated feedback on your performance on each practical exercise. They help you understand your mistakes, learn from them, and improve your skills."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "What is the AI Coach?")}>
        {dgettext(
          "faq",
          "Our AI Coach analyzes your performance, goals, and interests to give you personalized feedback, helping you improve faster."
        )}
      </.faq_item>
    </div>
    """
  end

  @doc """
  Renders all FAQ sections together with section titles.

  ## Example

      <.faq_all />
  """
  attr :class, :string, default: ""

  def faq_all(assigns) do
    ~H"""
    <div class={["flex flex-col gap-8", @class]}>
      <.faq_subscriptions title={dgettext("faq", "Subscriptions & Billing")} />
      <.faq_general title={dgettext("faq", "General")} />
    </div>
    """
  end
end
