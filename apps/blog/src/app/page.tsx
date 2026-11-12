import { PostList } from "@/components/post-list";

const INTRO = {
  text: "Zoonk builds you a study plan for each day, from any goal. Here's what we're building, and why.",
  title: "Zoonk blog",
};

export default function Home() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{INTRO.title}</h1>
      <p className="text-muted-foreground mt-2 mb-10 text-pretty">{INTRO.text}</p>

      <PostList />
    </>
  );
}
