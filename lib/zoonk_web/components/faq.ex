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
    <div class={["mb-8 text-center", @class]}>
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
          "For billing-related questions, refunds, or subscription changes, please email us directly at %{billing_email} or use the contact form above. We'll respond within %{days} business days.",
          billing_email: Support.billing_email(),
          days: Support.response_time_days()
        )}
      </.faq_item>

      <.faq_item question={
        dgettext("faq", "What's the difference between a subscription and buying a course?")
      }>
        {dgettext(
          "faq",
          "When you buy a course, you pay once and get lifetime access to that course only. You won't get other courses or personalized exercises and premium features for the course you bought."
        )}
        <br /><br />
        {dgettext(
          "faq",
          "When you subscribe, you get access to all courses, including personalized exercises and premium features, as long as your subscription is active."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "What's a lifetime subscription?")}>
        {dgettext(
          "faq",
          "This is a limited offer for early supporters. Pay once for lifetime access to Zoonk. You'll never pay a subscription again for the chosen plan. Plus, your support helps us fund the project without outside investors."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "How do I cancel my subscription?")}>
        {dgettext(
          "faq",
          "You can cancel anytime from your account settings or by emailing us at %{email}.",
          email: Support.billing_email()
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
  Renders course purchase related FAQ items.

  ## Example

      <.faq_courses />
      <.faq_courses title="Course Purchases" />
  """
  attr :class, :string, default: ""
  attr :title, :string, default: nil

  def faq_courses(assigns) do
    ~H"""
    <div class={@class}>
      <.text :if={@title} tag="h3" size={:lg} weight={:semibold} class="text-zk-foreground mb-4">
        {@title}
      </.text>
      <.faq_item question={
        dgettext("faq", "What's the difference between buying a course and a subscription?")
      }>
        {dgettext(
          "faq",
          "When you buy a course, you pay once and get lifetime access to that specific course only. You'll have access to all lessons and regular exercises for that course forever, but you won't get access to other courses, personalized exercises, or premium features."
        )}
        <br /><br />
        {dgettext(
          "faq",
          "When you subscribe, you get access to all courses, including personalized exercises and premium features, as long as your subscription is active."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "What does lifetime access mean?")}>
        {dgettext(
          "faq",
          "Lifetime access means you can access this course forever after your one-time purchase. There are no recurring fees, and you'll continue to have access even if we update our pricing or change our business model. You'll also receive any updates or improvements we make to the course content at no additional cost. However, some premium features like personalized exercises won't be included."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "What's included when I buy a course?")}>
        {dgettext(
          "faq",
          "When you buy a course, you get:"
        )}
        <br />
        {dgettext("faq", "• Lifetime access to all lessons in the course")}
        <br />
        {dgettext("faq", "• All regular exercises")}
        <br />
        {dgettext("faq", "• Any future updates to the course content")}
        <br />
        {dgettext("faq", "• Basic progress tracking")}
        <br /><br />
        {dgettext(
          "faq",
          "You will not get access to personalized exercises, premium features, or other courses on the platform."
        )}
      </.faq_item>

      <.faq_item question={
        dgettext("faq", "Can I get personalized exercises with a course purchase?")
      }>
        {dgettext(
          "faq",
          "No, personalized exercises are only available with a subscription. When you buy a course, you get access to all the regular exercises, which are the same for everyone. Personalized exercises are tailored to your specific interests and goals, and they're more expensive to generate, so they're only included in our subscription plans."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "Can I upgrade to a subscription later?")}>
        {dgettext(
          "faq",
          "Yes, you can upgrade to a subscription at any time. Your course purchase won't be credited toward the subscription cost, but you'll gain access to all other courses, personalized exercises, and premium features while your subscription is active."
        )}
      </.faq_item>

      <.faq_item question={dgettext("faq", "What if I have technical issues with the course?")}>
        {dgettext(
          "faq",
          "If you experience any technical issues, please reach out to our support team and we'll resolve any problems quickly so you can get back to learning. Feel free to send an email to %{email} with details about the issue you're facing.",
          email: Support.support_email()
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
      <.faq_courses title={dgettext("faq", "Course Purchases")} />
      <.faq_general title={dgettext("faq", "General")} />
    </div>
    """
  end
end
