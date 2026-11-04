package com.zoonk.android.feature.session

import android.app.Activity
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule

/**
 * Opens the window as an unfolded book foldable, flat. The publisher tells only what's composed when it publishes, so it
 * tells again what the fold composed, as a device tells every new reader.
 */
internal fun WindowLayoutInfoPublisherRule.unfoldBook(
    activity: Activity,
    waitForIdle: () -> Unit,
) = repeat(2) {
    overrideWindowLayoutInfo(
        TestWindowLayoutInfo(
            listOf(FoldingFeature(activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
        ),
    )
    waitForIdle()
}
