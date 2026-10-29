package com.zoonk.android.ui.characters

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.MutatorMutex
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlin.coroutines.cancellation.CancellationException

internal class CharacterActs<Expression, Act>(
    val act: (Act) -> CharacterAct<Expression>,
    val blink: Act,
    val openEyes: Set<Expression>,
    val expressions: List<Expression>,
)

/**
 * A character's acting. `play` acts on cue, where the character is the screen's subject (the buddy's
 * chat, a duel); it never runs on a timer. Survives rotation and the way back with the face it
 * landed on.
 */
@Stable
class ActorState<Expression, Act> internal constructor(
    private val acts: CharacterActs<Expression, Act>,
    landed: Expression?,
    internal var reacted: Boolean,
) {
    internal var landed: Expression? by mutableStateOf(landed)
        private set

    internal var playing: Playing<Expression>? by mutableStateOf(null)
        private set

    internal var frame by mutableFloatStateOf(0f)
        private set

    /** The face the character shows when no act has landed; null until it's drawn. */
    internal var resting: Expression? = null

    private val mutex = MutatorMutex()

    /**
     * Plays the act from the face shown and lands on its expression. True once it lands; false when
     * another act stopped it, which lands this one at once.
     */
    suspend fun play(act: Act): Boolean = play(act, delayMillis = 0)

    internal suspend fun play(
        name: Act,
        delayMillis: Int,
    ): Boolean {
        val act = acts.act(name)

        return try {
            mutex.mutate {
                val scale = currentCoroutineContext()[MotionDurationScale]?.scaleFactor ?: 1f
                // Off the frame clock, so nothing draws while it waits.
                delay((delayMillis * scale).toLong())
                val from = landed ?: resting ?: return@mutate false

                // With animations off it lands before the next frame, so the face it leaves never shows.
                if (scale == 0f) {
                    landed = act.to ?: from
                    return@mutate true
                }

                frame = 0f
                playing = Playing(act, from)

                try {
                    animate(0f, act.frames, animationSpec = tween(act.durationMillis, easing = LinearEasing)) { value, _ -> frame = value }
                } finally {
                    landed = act.to ?: from
                    playing = null
                }

                true
            }
        } catch (interrupted: CancellationException) {
            currentCoroutineContext().ensureActive()
            false
        }
    }

    /** After a reaction, one blink about 2 s later where its eyes are open, then rest. */
    internal suspend fun react(reaction: ActReaction<Act>) {
        if (reacted) return
        reacted = true

        if (play(reaction.act, reaction.delayMillis) && (landed ?: resting) in acts.openEyes) {
            play(acts.blink, CharacterAct.millis(BLINK_AFTER_FRAMES))
        }
    }

    internal fun landing(act: Act): Expression? = acts.act(act).to

    /** An act under way is saved as landed, so rotation or the way back draws where it was going. */
    internal val landingNow: Expression? get() = playing?.let { it.act.to ?: it.from } ?: landed
}

internal class Playing<Expression>(
    val act: CharacterAct<Expression>,
    val from: Expression,
)

@Composable
internal fun <Expression : Enum<Expression>, Act> rememberActorState(acts: CharacterActs<Expression, Act>): ActorState<Expression, Act> =
    rememberSaveable(saver = actorStateSaver(acts)) { ActorState(acts, landed = null, reacted = false) }

internal fun <Expression : Enum<Expression>, Act> actorStateSaver(
    acts: CharacterActs<Expression, Act>,
): Saver<ActorState<Expression, Act>, Any> =
    listSaver(
        save = { listOf(it.landingNow?.ordinal ?: -1, it.reacted) },
        restore = { ActorState(acts, acts.expressions.getOrNull(it[0] as Int), it[1] as Boolean) },
    )

/**
 * `reaction` plays once, on the moment's beat; where the moment doesn't play again (rotation, the way
 * back) it's drawn still in the act's landing.
 */
@Composable
internal fun <Expression, Act> CharacterActor(
    drawing: CharacterDrawing<Expression>,
    expression: Expression,
    reaction: ActReaction<Act>?,
    state: ActorState<Expression, Act>,
    label: String?,
    modifier: Modifier,
) {
    val resting = if (reaction != null && state.reacted) state.landing(reaction.act) ?: expression else expression

    SideEffect { state.resting = resting }

    if (reaction != null) {
        LaunchedEffect(state, reaction) { state.react(reaction) }
    }

    Canvas(modifier.characterFrame(label)) {
        val playing = state.playing

        if (playing == null) drawCharacter(drawing, state.landed ?: resting) else drawAct(drawing, playing, state.frame)
    }
}

@Composable
internal fun <Expression> CharacterStill(
    drawing: CharacterDrawing<Expression>,
    expression: Expression,
    label: String?,
    modifier: Modifier,
) {
    Canvas(modifier.characterFrame(label)) { drawCharacter(drawing, expression) }
}

/** Hidden from TalkBack unless `label` names it: omit it only when words beside it already do. */
private fun Modifier.characterFrame(label: String?): Modifier =
    aspectRatio(1f).then(
        if (label == null) {
            Modifier
        } else {
            Modifier.semantics {
                contentDescription = label
                role = Role.Image
            }
        },
    )

/** Parts without a track keep the pose they're drawn in. */
private fun <Expression> DrawScope.drawAct(
    drawing: CharacterDrawing<Expression>,
    playing: Playing<Expression>,
    frame: Float,
) {
    val act = playing.act
    val from = playing.from
    val to = act.to ?: from

    drawCharacter(drawing, act.face(frame, from)) { part ->
        val fromPose = drawing.pose(from, part)
        val track = act.track(part)

        track?.pose(frame, act.frames, fromPose ?: track.rest, drawing.pose(to, part) ?: track.rest) ?: fromPose ?: PartPose.Still
    }
}

private const val BLINK_AFTER_FRAMES = 48f
