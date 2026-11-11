package com.zoonk.android.feature.player.steps

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * What the learner did on a screen, which the lesson keeps for the screen's round (exactly as long as
 * its answer) and both pages of a spread share: each page's own work, which comes back when the
 * learner returns to the screen, and its canvas, drawn as one piece that moves between the one
 * column and a page with what it remembers.
 */
@Stable
class ScreenWork internal constructor(
    private val id: String,
    private val holder: SaveableStateHolder,
    internal val canvas: @Composable (@Composable () -> Unit) -> Unit,
) {
    /** One of the screen's places: the learner's turn (the one column without a fold) or the screen's page before the fold. */
    @Composable
    fun Page(
        turn: Boolean,
        content: @Composable () -> Unit,
    ) = holder.SaveableStateProvider(pageKey(id, turn), content)
}

val LocalScreenWork = staticCompositionLocalOf<ScreenWork?> { null }

/** [firstRound]: the round of a question's first attempt, whose work its earlier copy still shows after the retry starts. */
@Composable
fun rememberScreenWork(
    holder: SaveableStateHolder,
    stepId: String,
    round: Int,
    firstRound: Int?,
): ScreenWork {
    val id = workKey(stepId, round)
    val part =
        remember(stepId) {
            movableContentOf {
                key: String,
                content: @Composable () -> Unit,
                ->
                holder.SaveableStateProvider(key, content)
            }
        }

    LaunchedEffect(stepId, round, firstRound) {
        (0 until round).filter { it != firstRound }.map { workKey(stepId, it) }.forEach { ended ->
            listOf(ended, pageKey(ended, turn = true), pageKey(ended, turn = false)).forEach(holder::removeState)
        }
    }

    return remember(part, id) { ScreenWork(id, holder) { content -> part(id, content) } }
}

/** Outside a lesson a canvas keeps its work itself. */
@Composable
internal fun ScreenCanvas(content: @Composable () -> Unit) {
    val work = LocalScreenWork.current
    if (work == null) content() else work.canvas(content)
}

private fun workKey(
    stepId: String,
    round: Int,
) = "$stepId:$round"

private fun pageKey(
    id: String,
    turn: Boolean,
) = if (turn) "$id:turn" else "$id:screen"
