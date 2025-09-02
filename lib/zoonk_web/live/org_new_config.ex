defmodule ZoonkWeb.OrgNewConfig do
  @moduledoc false
  use Gettext, backend: Zoonk.Gettext

  def steps do
    [
      %{label: dgettext("orgs", "Start"), field: nil},
      %{label: dgettext("orgs", "Name"), field: :display_name},
      %{label: dgettext("orgs", "Subdomain"), field: :subdomain},
      %{label: dgettext("orgs", "Visibility"), field: :is_public},
      %{label: dgettext("orgs", "Mode"), field: :mode},
      %{label: dgettext("orgs", "Done"), field: :done}
    ]
  end

  def total_steps, do: length(steps())

  def use_cases do
    [
      %{
        icon: "tabler-speakerphone",
        title: dgettext("orgs", "Marketing"),
        subtitle: dgettext("orgs", "Engaging customer learning"),
        description:
          dgettext(
            "orgs",
            "Create courses to show how your product works, guide new customers, and reduce support needs."
          ),
        benefits: [
          %{icon: "tabler-user-plus", text: dgettext("orgs", "Customer onboarding")},
          %{icon: "tabler-book", text: dgettext("orgs", "Product tutorials")},
          %{icon: "tabler-lifebuoy", text: dgettext("orgs", "Self-service support")}
        ]
      },
      %{
        icon: "tabler-shield-check",
        title: dgettext("orgs", "Internal Training"),
        subtitle: dgettext("orgs", "Aligned and informed teams"),
        description:
          dgettext(
            "orgs",
            "Train employees on any internal process. From onboarding to compliance, create the courses your team needs."
          ),
        benefits: [
          %{icon: "tabler-users", text: dgettext("orgs", "New hire onboarding")},
          %{icon: "tabler-briefcase", text: dgettext("orgs", "Team workflows")},
          %{icon: "tabler-scale", text: dgettext("orgs", "Compliance training")}
        ]
      },
      %{
        icon: "tabler-brain",
        title: dgettext("orgs", "Professional Development"),
        subtitle: dgettext("orgs", "Continuous skill growth"),
        description:
          dgettext(
            "orgs",
            "Give employees or students access to AI-powered courses and learning paths, in any subject they want to explore."
          ),
        benefits: [
          %{icon: "tabler-brain", text: dgettext("orgs", "Personalized learning paths")},
          %{icon: "tabler-rocket", text: dgettext("orgs", "Career skill growth")},
          %{icon: "tabler-graph", text: dgettext("orgs", "Progress tracking")}
        ]
      },
      %{
        icon: "tabler-school",
        title: dgettext("orgs", "Schools & Creators"),
        subtitle: dgettext("orgs", "Interactive learning for everyone"),
        description:
          dgettext(
            "orgs",
            "Build interactive courses for your students or audience. Keep learners engaged and follow their progress step by step."
          ),
        benefits: [
          %{icon: "tabler-chalkboard", text: dgettext("orgs", "Interactive lessons")},
          %{icon: "tabler-chart-line", text: dgettext("orgs", "Progress tracking")},
          %{icon: "tabler-mood-smile", text: dgettext("orgs", "Learner engagement")}
        ]
      }
    ]
  end

  def visibility_opts do
    [
      %{
        value: true,
        label: dgettext("orgs", "Public"),
        description:
          dgettext("orgs", "Perfect for marketing, product tutorials, and educational content that anyone can access."),
        use_cases: [
          %{icon: "tabler-world", text: dgettext("orgs", "Anyone can discover and access your courses")},
          %{icon: "tabler-users-group", text: dgettext("orgs", "Great for building an audience")},
          %{icon: "tabler-lock-open", text: dgettext("orgs", "Free for learners to join")}
        ]
      },
      %{
        value: false,
        label: dgettext("orgs", "Private"),
        description:
          dgettext("orgs", "Ideal for internal teams, schools, and exclusive content for your existing audience."),
        use_cases: [
          %{icon: "tabler-lock", text: dgettext("orgs", "Only invited members can access")},
          %{icon: "tabler-users", text: dgettext("orgs", "Perfect for team training")},
          %{icon: "tabler-shield-check", text: dgettext("orgs", "Full control over membership")}
        ]
      }
    ]
  end
end
