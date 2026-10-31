package com.zoonk.android.ui.characters

import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Immutable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.lerp
import androidx.compose.ui.layout.ScaleFactor
import androidx.compose.ui.layout.lerp
import androidx.compose.ui.util.lerp
import com.zoonk.android.ui.theme.ZoonkMotion
import kotlin.math.roundToInt

/**
 * Characters act with their parts, never the whole drawing at once (main's `_character`). A part
 * turns, stretches and moves around its own pivot, in the character's drawing units.
 */
internal enum class CharacterPart {
    Antenna,
    AntennaLeft,
    AntennaRight,
    ArmLeft,
    ArmRight,
    Body,
    Torso,
    Feet,
    Shadow,
    Head,
    Face,
    BrowLeft,
    BrowRight,
    EyeLeft,
    EyeRight,
    PupilLeft,
    PupilRight,
    LidLeft,
    LidRight,
    Mouth,
    Mask,
    Snore,
    Sweat,
    Crown,
    Sign,
    Tail,
}

@Immutable
internal data class PartPose(
    val opacity: Float = 1f,
    val rotate: Float = 0f,
    val scale: ScaleFactor = ScaleFactor(1f, 1f),
    val translate: Offset = Offset.Zero,
) {
    companion object {
        val Still = PartPose()
        val Hidden = PartPose(opacity = 0f)
    }
}

/** `Hold` keeps a part where it is until the key, then changes it at once. */
internal enum class ActEase(
    private val easing: Easing,
) {
    Accelerate(ZoonkMotion.EaseAccelerate),
    Follow(ZoonkMotion.EaseFollow),
    Hold(Easing { if (it < 1f) 0f else 1f }),
    Out(ZoonkMotion.EaseOut),
    Spring(ZoonkMotion.EaseSpring),
    Swing(ZoonkMotion.EaseSwing),
    ;

    fun transform(progress: Float): Float = easing.transform(progress.coerceIn(0f, 1f))
}

/** Only what it sets moves at that key. */
internal class ActKey(
    val at: Float,
    val ease: ActEase? = null,
    val opacity: Float? = null,
    val rotate: Float? = null,
    val scale: ScaleFactor? = null,
    val translate: Offset? = null,
)

/**
 * Starts from the pose the part is drawn in and ends at the landing expression's pose on `settle`'s
 * curve, so an act never jumps; a key at frame 0 or at the last frame replaces that end. `rest` is
 * the part's pose when no expression poses it.
 */
internal class ActTrack(
    val part: CharacterPart,
    val keys: List<ActKey>,
    val rest: PartPose = PartPose.Still,
    val settle: ActEase? = null,
) {
    fun pose(
        frame: Float,
        frames: Float,
        from: PartPose,
        to: PartPose,
    ): PartPose =
        PartPose(
            opacity = value(frame, frames, from.opacity, to.opacity, ActKey::opacity, ::lerp),
            rotate = value(frame, frames, from.rotate, to.rotate, ActKey::rotate, ::lerp),
            scale = value(frame, frames, from.scale, to.scale, ActKey::scale, ::lerp),
            translate = value(frame, frames, from.translate, to.translate, ActKey::translate, ::lerp),
        )

    /** Each segment eases on the curve of the key it reaches, as `element.animate()` plays main's keyframes. */
    private inline fun <T : Any> value(
        frame: Float,
        frames: Float,
        from: T,
        to: T,
        property: (ActKey) -> T?,
        lerp: (T, T, Float) -> T,
    ): T {
        var previousAt = 0f
        var previous = from
        var first = true

        for (key in keys) {
            val value = property(key) ?: continue

            if (first && key.at == 0f) {
                first = false
                previous = value
                continue
            }

            first = false

            if (frame < key.at) {
                val progress = (frame - previousAt) / (key.at - previousAt)
                return lerp(previous, value, (key.ease ?: ActEase.Out).transform(progress))
            }

            previousAt = key.at
            previous = value
        }

        return when {
            !first && previousAt == frames -> previous
            frame >= frames -> to
            else -> lerp(previous, to, (settle ?: ActEase.Out).transform((frame - previousAt) / (frames - previousAt)))
        }
    }
}

/**
 * Timed in frames at 24 a second (main's `duration-frame`). At `swapAt` the face swaps to the
 * landing expression's, usually while the eyes are shut or a part is squashed, so it reads as one
 * motion.
 */
internal class CharacterAct<Expression>(
    val frames: Float,
    val tracks: List<ActTrack>,
    val to: Expression? = null,
    val swapAt: Float? = null,
) {
    private val byPart = CharacterPart.entries.associateWith { part -> tracks.firstOrNull { it.part == part } }

    val durationMillis: Int get() = millis(frames)

    fun track(part: CharacterPart): ActTrack? = byPart[part]

    fun face(
        frame: Float,
        from: Expression,
    ): Expression = if (to != null && swapAt != null && frame >= swapAt) to else from

    companion object {
        const val FRAMES_PER_SECOND = 24f
        private const val MILLIS_PER_SECOND = 1000f

        fun millis(frames: Float): Int = (frames * MILLIS_PER_SECOND / FRAMES_PER_SECOND).roundToInt()
    }
}

/** Plays once where something just happened, `delayMillis` after the character appears. */
@Immutable
data class ActReaction<Act>(
    val act: Act,
    val delayMillis: Int = 0,
)
