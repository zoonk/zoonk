package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.api.models.StepMarks
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf11Value as LabeledDiagramContent

/** Core's picture wait, which covers the drawing's retries. */
private const val PICTURE_WAIT_MS = 300_000L

/** The screen's own picture is still being drawn; a check's option pictures are not its own. */
val LessonStep.isOwnPictureDrawing: Boolean get() = imagePending && image == null && picture != null

/** The API's `required`: the question is about the picture's numbered parts and can't be answered without it. */
val LessonStep.isRequiredPictureDrawing: Boolean get() = isOwnPictureDrawing && picture?.required == true

/** An explanation's labeled diagram can't be explored once its picture won't come. */
val LessonStep.isExploredPictureLost: Boolean
    get() = (content as? StepContent.Explanation)?.explore?.content is LabeledDiagramContent && image == null && !imagePending

fun LessonStep.isWaitingForPicture(
    openedAt: Long,
    now: Long,
): Boolean = imagePending && now - (pictureWaitStartedAt ?: openedAt) < PICTURE_WAIT_MS

/** Core's `marksPending`: marks, `about` lines and icons come while any screen is within its picture wait. */
fun LessonPlayerState.isWaitingForMarks(
    openedAt: Long,
    now: Long,
): Boolean = now - (steps.values.mapNotNull(LessonStep::pictureWaitStartedAt).maxOrNull() ?: openedAt) < PICTURE_WAIT_MS

/**
 * Pictures drawn and marks tagged since the lesson opened; then, with their wait over, screens stop
 * waiting and a numbered picture's question that never got it is left out (main's
 * `getLostNumberedScreens`). The screen on view takes only its underline, which moves nothing; its
 * strip, example and icon wait until the learner leaves it ([heldMarks]). The map takes its `about`
 * lines and icons at once.
 */
fun LessonPlayerState.withLateContent(
    fresh: List<LessonStep>,
    openedAt: Long,
    now: Long,
): LessonPlayerState {
    val onView = queue.getOrNull(position)
    val held =
        fresh
            .filter { it.id == onView }
            .mapNotNull { read -> read.marks?.takeIf { it != steps[read.id]?.marks }?.let { read.id to it } }
            .toMap()
    val drawn =
        steps.mapValues { (id, step) ->
            val read = fresh.firstOrNull { it.id == id }
            val updated =
                when {
                    read == null -> {
                        step
                    }

                    step.content is StepContent.Map -> {
                        val map = read.content as StepContent.Map
                        // The icons' room stays once kept, even when their wait ends without them, so nothing on the map moves.
                        step.copy(content = map.copy(keepsIconRoom = map.keepsIconRoom || (step.content as StepContent.Map).keepsIconRoom))
                    }

                    else -> {
                        step.copy(
                            image = if (step.imagePending) read.image ?: step.image else step.image,
                            imagePending = step.imagePending && read.imagePending,
                            optionPictures = if (step.imagePending) step.optionPictures + read.optionPictures else step.optionPictures,
                            marks = if (id == onView) step.marks.withUnderlineOf(read.marks) else read.marks ?: step.marks,
                        )
                    }
                }
            if (updated.imagePending && !updated.isWaitingForPicture(openedAt, now)) updated.copy(imagePending = false) else updated
        }
    val lost = drawn.values.filter { it.picture?.required == true && it.image == null && !it.imagePending }.map(LessonStep::id)

    return copy(steps = drawn, heldMarks = heldMarks + held).skipSteps(lost, now)
}

private fun StepMarks?.withUnderlineOf(fresh: StepMarks?): StepMarks? =
    when {
        fresh?.underline == null -> this
        this == null -> StepMarks(example = null, icon = null, ideaIndex = null, underline = fresh.underline)
        else -> copy(underline = fresh.underline)
    }

/** The marks held for a screen reach it once another screen is on view. */
fun LessonPlayerState.releasingHeldMarks(): LessonPlayerState {
    val onView = queue.getOrNull(position)
    val released = heldMarks.filterKeys { it != onView }
    if (released.isEmpty()) return this

    return copy(
        steps = steps.mapValues { (id, step) -> released[id]?.let { step.copy(marks = it) } ?: step },
        heldMarks = heldMarks - released.keys,
    )
}
