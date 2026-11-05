package com.zoonk.android.ui.scaffold

import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.window.layout.DisplayFeature
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule

/**
 * Opens the window as an unfolded book foldable: a fold down its middle, flat unless [state] half
 * opens it, or a tabletop's across it with a horizontal [orientation]. The publisher tells only the
 * readers already listening, so this waits for the content, whose `ZoonkTheme` reads the window.
 */
fun AndroidComposeTestRule<*, *>.unfoldBook(
    folds: WindowLayoutInfoPublisherRule,
    state: FoldingFeature.State = FoldingFeature.State.FLAT,
    orientation: FoldingFeature.Orientation = FoldingFeature.Orientation.VERTICAL,
) = publish(folds, listOf(FoldingFeature(activity, state = state, orientation = orientation)))

/** Closes the book: the window has no fold. */
fun AndroidComposeTestRule<*, *>.closeBook(folds: WindowLayoutInfoPublisherRule) = publish(folds, emptyList())

private fun AndroidComposeTestRule<*, *>.publish(
    folds: WindowLayoutInfoPublisherRule,
    features: List<DisplayFeature>,
) {
    waitForIdle()
    folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(features))
    waitForIdle()
}
