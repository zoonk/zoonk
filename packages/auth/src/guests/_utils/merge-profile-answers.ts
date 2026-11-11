import { type GuestLinkContext } from "./merge-keyed-rows";

export async function mergeProfileAnswers({ guestUserId, transaction, userId }: GuestLinkContext) {
  const accountAnswers = await transaction.profileAnswer.findMany({ where: { userId } });
  const guestAnswers = await transaction.profileAnswer.findMany({ where: { userId: guestUserId } });
  const accountQuestions = new Set(accountAnswers.map((answer) => answer.question));

  // Prisma reads an empty `OR` here as matching every guest profile fact, not none.
  if (accountQuestions.size > 0) {
    await transaction.memoryFact.deleteMany({
      where: {
        AND: [
          { sourceRef: { equals: "profile", path: ["kind"] } },
          {
            OR: [...accountQuestions].map((question) => ({
              sourceRef: { equals: question, path: ["id"] },
            })),
          },
        ],
        userId: guestUserId,
      },
    });
  }

  if (accountQuestions.has("conditions")) {
    await transaction.learnerCondition.deleteMany({ where: { userId: guestUserId } });
  }

  const takeGuest = (question: "learningSupport" | "addressForm") =>
    !accountQuestions.has(question) && guestAnswers.some((answer) => answer.question === question);

  await transaction.$executeRaw`
    WITH guest_rows AS (
      DELETE FROM profile_answers WHERE user_id = ${guestUserId}::uuid RETURNING *
    )
    INSERT INTO profile_answers (id, user_id, question, version, outcome, answered_at)
    SELECT id, ${userId}::uuid, question, version, outcome, answered_at FROM guest_rows
    ORDER BY question ON CONFLICT (user_id, question) DO NOTHING
  `;

  await transaction.$executeRaw`
    WITH guest_rows AS (
      DELETE FROM learner_conditions WHERE user_id = ${guestUserId}::uuid RETURNING *
    )
    INSERT INTO learner_conditions (id, user_id, condition, note, created_at)
    SELECT id, ${userId}::uuid, condition, note, created_at FROM guest_rows
    ORDER BY condition ON CONFLICT (user_id, condition) DO NOTHING
  `;

  return {
    takeGuestAddressForm: takeGuest("addressForm"),
    takeGuestSupport: takeGuest("learningSupport"),
  };
}
