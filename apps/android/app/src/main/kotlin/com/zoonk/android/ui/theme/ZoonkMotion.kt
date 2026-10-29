package com.zoonk.android.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing

/**
 * Main's motion tokens (`packages/ui/src/styles/globals.css`); what each is for is in the
 * `zoonk-motion` skill. Compose scales and zeroes durations with the animator duration scale.
 */
object ZoonkMotion {
    /** A celebration plays one thing at a time, in reading order, a beat apart. */
    const val BEAT_MILLIS = 250

    /** Between items of one list that celebrate together. */
    const val STAGGER_MILLIS = 100

    val EaseOut: Easing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
    val EaseAccelerate: Easing = CubicBezierEasing(0.55f, 0f, 1f, 0.45f)
    val EaseSwing: Easing = CubicBezierEasing(0.45f, 0f, 0.55f, 1f)

    /** SwiftUI's `Spring(duration: 0.5, bounce: 0.3)`, sampled over the settle's 650 ms. */
    val EaseSpring: Easing =
        SampledEasing(
            0f to 0f,
            0.015f to 0.007f,
            0.03f to 0.027f,
            0.047f to 0.061f,
            0.067f to 0.114f,
            0.082f to 0.161f,
            0.1f to 0.224f,
            0.167f to 0.47f,
            0.198f to 0.582f,
            0.23f to 0.683f,
            0.262f to 0.771f,
            0.292f to 0.841f,
            0.322f to 0.899f,
            0.352f to 0.946f,
            0.383f to 0.983f,
            0.415f to 1.01f,
            0.45f to 1.029f,
            0.488f to 1.041f,
            0.53f to 1.046f,
            0.598f to 1.042f,
            0.832f to 1.007f,
            0.93f to 1f,
            1f to 1f,
        )

    /** A spring with damping 0.45: a 20% overshoot, then one small swing back. */
    val EaseFollow: Easing =
        SampledEasing(
            0f to 0f,
            0.042f to 0.11f,
            0.083f to 0.362f,
            0.125f to 0.652f,
            0.167f to 0.906f,
            0.208f to 1.086f,
            0.25f to 1.182f,
            0.292f to 1.205f,
            0.333f to 1.178f,
            0.375f to 1.124f,
            0.417f to 1.065f,
            0.458f to 1.014f,
            0.5f to 0.979f,
            0.542f to 0.961f,
            0.583f to 0.958f,
            0.625f to 0.965f,
            0.667f to 0.976f,
            0.708f to 0.988f,
            0.75f to 0.998f,
            0.792f to 1.005f,
            0.833f to 1.008f,
            0.875f to 1.009f,
            0.917f to 1.007f,
            0.958f to 1.005f,
            1f to 1f,
        )
}

/** CSS's `linear()`: straight lines between sampled (progress, value) points. */
private class SampledEasing(
    vararg points: Pair<Float, Float>,
) : Easing {
    private val inputs = FloatArray(points.size) { points[it].first }
    private val outputs = FloatArray(points.size) { points[it].second }

    override fun transform(fraction: Float): Float {
        val upper = inputs.indexOfFirst { it >= fraction }
        if (upper <= 0) return if (upper == 0) outputs[0] else outputs.last()

        val share = (fraction - inputs[upper - 1]) / (inputs[upper] - inputs[upper - 1])
        return outputs[upper - 1] + (outputs[upper] - outputs[upper - 1]) * share
    }
}
