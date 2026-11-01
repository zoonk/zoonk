package com.zoonk.android.feature.player.steps

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.staticCompositionLocalOf
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.ApiJson
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

/**
 * What the learner did on a screen, which the lesson keeps for the screen's round (exactly as long as
 * its answer) and both pages of a spread share: its canvas, drawn as one piece that moves between the
 * one column and a page with what it remembers, and a copy of an activity's answer, since the player
 * loses its answer when Android closes the app in the background while the canvas gets its work back.
 */
@Stable
class ScreenWork internal constructor(
    internal val canvas: @Composable (@Composable () -> Unit) -> Unit,
    internal val keptAnswer: MutableState<ActivityAnswer?>,
)

val LocalScreenWork = staticCompositionLocalOf<ScreenWork?> { null }

@Composable
fun rememberScreenWork(
    holder: SaveableStateHolder,
    stepId: String,
    position: Int,
    round: Int,
): ScreenWork {
    val part =
        remember(stepId, position) {
            movableContentOf {
                key: String,
                content: @Composable () -> Unit,
                ->
                holder.SaveableStateProvider(key, content)
            }
        }
    val keptAnswer = rememberSaveable(stepId, position, round, stateSaver = KeptAnswerSaver) { mutableStateOf<ActivityAnswer?>(null) }

    LaunchedEffect(stepId, round) { if (round > 0) holder.removeState(workKey(stepId, round - 1)) }

    return remember(part, keptAnswer, stepId, round) { ScreenWork({ content -> part(workKey(stepId, round), content) }, keptAnswer) }
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

private val KeptAnswerSaver: Saver<ActivityAnswer?, String> =
    Saver(save = { answer -> answer?.let { ApiJson.encodeToString(it) } }, restore = { ApiJson.decodeFromString(it) })
