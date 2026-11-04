/**
 * The answer to a request a tap sent, or what the tap resolves to without one: true once the learner
 * left, since the screen they left has nothing to report even when they come back, and false when
 * the request failed while they're still there.
 */
export async function answerHere<T>(
  request: Promise<T>,
  stillHere: () => boolean,
): Promise<{ answer: T } | boolean> {
  const answered = await request.then(
    (answer) => ({ answer }),
    () => false,
  );

  return stillHere() ? answered : true;
}
