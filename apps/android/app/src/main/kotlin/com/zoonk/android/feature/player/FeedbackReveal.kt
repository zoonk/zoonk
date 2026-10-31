package com.zoonk.android.feature.player

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import kotlin.math.min

internal enum class RevealPart { Question, Verdict, Feedback, Result }

/** Where a screen's question and a check's feedback sit, so the feedback can come into view without the question leaving it. */
internal class FeedbackReveal {
    private val parts = mutableMapOf<RevealPart, LayoutCoordinates>()
    var viewport: LayoutCoordinates? = null

    fun place(
        part: RevealPart,
        coordinates: LayoutCoordinates,
    ) {
        parts[part] = coordinates
    }

    /**
     * Main's `useRevealFeedback`: how far to scroll to show the whole feedback, unless that scrolls the
     * question away while less would still show the verdict; then only as far as keeps the question in view.
     */
    fun scrollBy(margin: Float): Float {
        val view = viewport?.takeIf { it.isAttached } ?: return 0f
        val bounds = { part: RevealPart -> parts[part]?.takeIf { it.isAttached }?.let { view.localBoundingBoxOf(it, clipBounds = false) } }
        val feedback = listOfNotNull(bounds(RevealPart.Feedback), bounds(RevealPart.Result)).filter { it.height > 0 }
        if (feedback.isEmpty()) return 0f

        val top = feedback.minOf { it.top }
        val bottom = feedback.maxOf { it.bottom }
        val height = view.size.height
        val whole =
            when {
                top < 0 -> top - margin
                bottom > height -> min(bottom - height + margin, top - margin)
                else -> 0f
            }
        val question = bounds(RevealPart.Question) ?: return whole
        val verdict = bounds(RevealPart.Verdict) ?: return whole
        val keepsQuestion = question.top - margin
        val showsVerdict = verdict.bottom - height + margin

        return if (whole > keepsQuestion && keepsQuestion >= 0 && showsVerdict <= keepsQuestion) keepsQuestion else whole
    }
}

internal val LocalFeedbackReveal = staticCompositionLocalOf<FeedbackReveal?> { null }

internal fun Modifier.revealPart(
    reveal: FeedbackReveal?,
    part: RevealPart,
): Modifier = if (reveal == null) this else onGloballyPositioned { reveal.place(part, it) }
