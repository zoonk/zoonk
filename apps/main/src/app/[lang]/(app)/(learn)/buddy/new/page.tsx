import { handOverBuddyPage } from "../buddy-first-page";
import { BuddyPage } from "../buddy-pages";

export default async function NewBuddyConversationPage() {
  await handOverBuddyPage(() => Promise.resolve({}));
  return <BuddyPage />;
}
