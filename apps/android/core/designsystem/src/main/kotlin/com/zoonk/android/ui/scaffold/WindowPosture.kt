package com.zoonk.android.ui.scaffold

import android.annotation.SuppressLint
import android.content.Context
import androidx.compose.material3.adaptive.HingeInfo
import androidx.compose.material3.adaptive.Posture
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.toComposeRect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.window.WindowSdkExtensions
import androidx.window.core.layout.WindowSizeClass
import androidx.window.core.layout.computeWindowSizeClass
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import kotlinx.coroutines.flow.map

/**
 * The window's size class and posture, for every layout that adapts to them. Material's
 * `currentWindowAdaptiveInfoV2()` starts reading the folds where it's called and sees none until
 * that reading arrives, so a screen opened at a fold would show one column before its two pages.
 */
@Composable
fun windowAdaptiveInfo(): WindowAdaptiveInfo {
    val size = LocalWindowInfo.current.containerSize
    val sizeClass =
        with(LocalDensity.current) {
            WindowSizeClass.BREAKPOINTS_V2.computeWindowSizeClass(size.width.toDp().value, size.height.toDp().value)
        }

    return WindowAdaptiveInfo(sizeClass, LocalWindowPosture.current)
}

/** Reads the window's folds once for all of [content], so a screen opened later starts with them. */
@Composable
internal fun ReadWindowPosture(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val tracker = remember(context) { WindowInfoTracker.getOrCreate(context) }
    val updates = remember(tracker) { tracker.windowLayoutInfo(context).map { it.posture() } }
    val posture by updates.collectAsState(remember(tracker) { tracker.currentPosture(context) })

    CompositionLocalProvider(LocalWindowPosture provides posture, content = content)
}

private val LocalWindowPosture = compositionLocalOf { Posture() }

// WindowManager tells the folds at once from its extensions' version 9 (Android 16 QPR2). Before it, the first reading
// arrives after the first frame, as Material's always does. Lint (AGP 9.5) doesn't see this check against the compiled
// library, even in the form its RequiresWindowSdk docs show.
@SuppressLint("RequiresWindowSdk")
private fun WindowInfoTracker.currentPosture(context: Context): Posture {
    if (WindowSdkExtensions.getInstance().extensionVersion >= 9) {
        return getCurrentWindowLayoutInfo(context).posture()
    }
    return Posture()
}

/** Material's own mapping (its `calculatePosture`, which it keeps internal). */
private fun WindowLayoutInfo.posture(): Posture {
    val folds = displayFeatures.filterIsInstance<FoldingFeature>()

    return Posture(
        isTabletop = folds.any { it.orientation == FoldingFeature.Orientation.HORIZONTAL && it.state == FoldingFeature.State.HALF_OPENED },
        hingeList =
            folds.map {
                HingeInfo(
                    bounds = it.bounds.toComposeRect(),
                    isFlat = it.state == FoldingFeature.State.FLAT,
                    isVertical = it.orientation == FoldingFeature.Orientation.VERTICAL,
                    isSeparating = it.isSeparating,
                    isOccluding = it.occlusionType == FoldingFeature.OcclusionType.FULL,
                )
            },
    )
}
