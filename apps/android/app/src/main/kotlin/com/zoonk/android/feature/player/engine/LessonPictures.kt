package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PictureDescription
import com.zoonk.android.feature.player.model.StepContent

/** Core's picture wait, which covers the drawing's retries. */
private const val PICTURE_WAIT_MS = 300_000L

/** The picture a screen asks for; an explanation's is only a picture, never a question's. */
val LessonStep.askedPicture: PictureDescription?
    get() =
        when (val content = content) {
            is StepContent.Check -> content.content.image
            is StepContent.Guess -> content.content.image
            is StepContent.Fact -> content.content.image
            is StepContent.WorkedExample -> content.content.image
            is StepContent.Explanation -> content.content.image
            else -> null
        }

/** A question about numbered parts of a picture can't be answered without it. */
private val LessonStep.asksNumberedPicture: Boolean
    get() = content !is StepContent.Explanation && !askedPicture?.parts.isNullOrEmpty()

fun LessonStep.isWaitingForPicture(
    openedAt: Long,
    now: Long,
): Boolean = imagePending && now - (pictureWaitStartedAt ?: openedAt) < PICTURE_WAIT_MS

/**
 * Pictures drawn since the lesson opened; then, with their wait over, screens stop waiting and a
 * numbered picture's question that never got it is left out (main's `getLostNumberedScreens`).
 */
internal fun LessonPlayerState.withPictures(
    fresh: List<LessonStep>,
    openedAt: Long,
    now: Long,
): LessonPlayerState {
    val drawn =
        steps.mapValues { (id, step) ->
            val read = fresh.firstOrNull { it.id == id }
            val updated =
                if (step.imagePending && read != null) {
                    step.copy(
                        image = read.image ?: step.image,
                        imagePending = read.imagePending,
                        optionPictures =
                            step.optionPictures + read.optionPictures,
                    )
                } else {
                    step
                }
            if (updated.imagePending && !updated.isWaitingForPicture(openedAt, now)) updated.copy(imagePending = false) else updated
        }
    val lost = drawn.values.filter { it.asksNumberedPicture && it.image == null && !it.imagePending }.map(LessonStep::id)

    return copy(steps = drawn).skipSteps(lost, now)
}
