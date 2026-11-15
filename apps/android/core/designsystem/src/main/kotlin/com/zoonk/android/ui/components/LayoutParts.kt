package com.zoonk.android.ui.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.zoonk.android.designsystem.BuildConfig

/**
 * What an element of a shared piece is, for the render tests' layout capture: the parts and pieces of
 * the alignment report every platform writes (`REPORT-SHAPE.md`). Only debug builds mark parts.
 */
data class LayoutPart(
    val piece: String,
    val part: Part,
    /** An action's look: [Variant]. */
    val variant: Variant? = null,
    /** On a group: the space its layout puts between its rows. */
    val gap: Dp? = null,
    /** On a row: how far its content ends before its own end edge. */
    val endInset: Dp? = null,
    /** On a row: top-aligned as a whole (a text lead), so its end goes with its first line, not its center. */
    val firstLine: Boolean = false,
) {
    enum class Part(
        val id: String,
    ) {
        Group("group"),
        Row("row"),
        Mark("mark"),
        Label("label"),
        Note("note"),
        Value("value"),
        End("end"),
        Action("action"),
    }

    enum class Variant(
        val id: String,
    ) {
        Filled("filled"),
        Outline("outline"),
        Secondary("secondary"),
        Ghost("ghost"),
        Destructive("destructive"),
    }

    /** The pieces' names, the same on the web and Apple. */
    companion object Pieces {
        const val LIST = "list-group"
        const val CHOICES = "choice-list"
        const val NAVIGATION = "sidebar"
        const val WAIT = "wait-content"
        const val GENERATION_WAIT = "generation-wait"
        const val ACTIONS = "action"
    }
}

val LayoutPartKey = SemanticsPropertyKey<LayoutPart>("ZoonkLayoutPart") { parent, _ -> parent }

fun Modifier.layoutPart(
    piece: String,
    part: LayoutPart.Part,
    variant: LayoutPart.Variant? = null,
    gap: Dp? = null,
    endInset: Dp? = null,
    firstLine: Boolean = false,
): Modifier =
    // A constant in a release build, so R8 drops the marker and a learner's app never builds one.
    if (BuildConfig.DEBUG) semantics { this[LayoutPartKey] = LayoutPart(piece, part, variant, gap, endInset, firstLine) } else this

/** How many descriptions a row drew: the row's own presence decision, read by the layout capture. */
val DrawnDescriptionsKey = SemanticsPropertyKey<() -> Int>("ZoonkDrawnDescriptions") { parent, _ -> parent }

internal fun Modifier.drawnDescriptions(count: () -> Int): Modifier =
    if (BuildConfig.DEBUG) semantics { this[DrawnDescriptionsKey] = count } else this
