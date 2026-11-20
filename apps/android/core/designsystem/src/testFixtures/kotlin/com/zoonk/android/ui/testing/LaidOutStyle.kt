package com.zoonk.android.ui.testing

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle

/** The style the shown text holding [text] was laid out with, its line breaking and locale included. */
fun SemanticsNodeInteractionsProvider.laidOutStyle(text: String): TextStyle {
    val layouts = mutableListOf<TextLayoutResult>()
    onNodeWithText(text, substring = true, useUnmergedTree = true)
        .fetchSemanticsNode()
        .config[SemanticsActions.GetTextLayoutResult]
        .action
        ?.invoke(layouts)
    return layouts.first().layoutInput.style
}
