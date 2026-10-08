import { AdminFilterNav } from "@/components/admin-filter-nav";

const feedbackViews = [
  { href: "/feedback", label: "Votes" },
  { href: "/feedback/rates", label: "Downvote rates" },
  { href: "/feedback/messages", label: "Messages" },
] as const;

type FeedbackView = (typeof feedbackViews)[number]["href"];

/** Votes, rates and form messages are three views of the same feedback, one click apart. */
export function FeedbackViewsNav({ current }: { current: FeedbackView }) {
  return (
    <AdminFilterNav
      label="Feedback views"
      options={feedbackViews.map((view) => ({ ...view, isActive: view.href === current }))}
    />
  );
}
