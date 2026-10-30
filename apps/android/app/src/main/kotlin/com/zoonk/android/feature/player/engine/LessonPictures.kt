package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
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
    val lost = drawn.values.filter { it.picture?.required == true && it.image == null && !it.imagePending }.map(LessonStep::id)

    return copy(steps = drawn).skipSteps(lost, now)
}
