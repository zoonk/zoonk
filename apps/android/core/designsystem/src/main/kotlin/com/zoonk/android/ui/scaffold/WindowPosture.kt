package com.zoonk.android.ui.scaffold

import android.annotation.SuppressLint
import android.content.Context
import android.view.ViewTreeObserver
import androidx.compose.material3.adaptive.HingeInfo
import androidx.compose.material3.adaptive.Posture
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.toComposeRect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
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

    return WindowAdaptiveInfo(sizeClass, LocalWindowPosture.current ?: Posture())
}

/**
 * Reads the window's folds once for all of [content], so a screen opened later starts with them.
 * Until the first reading arrives the window doesn't draw, so its first frame lays out at the fold.
 */
@Composable
internal fun ReadWindowPosture(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val tracker = remember(context) { WindowInfoTracker.getOrCreate(context) }
    val readings = remember(tracker) { tracker.windowLayoutInfo(context).map<WindowLayoutInfo, Posture?> { it.posture() } }
    val posture by readings.collectAsState(remember(tracker) { tracker.currentPosture(context) })

    CompositionLocalProvider(LocalWindowPosture provides posture) {
        HoldUntilFoldsRead()
        content()
    }
}

/**
 * Keeps this window from drawing until the folds are read, so the splash, the frame before a
 * rotation or a fold, or a dialog or sheet restored with its screen, never shows a frame laid out
 * without the fold. WindowManager doesn't promise a first reading on every device, so it skips
 * [HELD_FRAMES] frames at most. A dialog of its own calls it first thing inside its window, as the
 * design system's dialogs and sheets do.
 */
@Composable
fun HoldUntilFoldsRead() {
    if (LocalWindowPosture.current != null) return

    val view = LocalView.current
    DisposableEffect(view) {
        val observer = view.viewTreeObserver
        var skipped = 0
        val hold = ViewTreeObserver.OnPreDrawListener { skipped++ >= HELD_FRAMES }
        observer.addOnPreDrawListener(hold)
        onDispose { if (observer.isAlive) observer.removeOnPreDrawListener(hold) }
    }
}

/** Null until the first reading arrives. */
private val LocalWindowPosture = compositionLocalOf<Posture?> { Posture() }

/** About half a second at 60 Hz. */
internal const val HELD_FRAMES = 30

// WindowManager tells the folds at once from its extensions' version 9 (Android 16 QPR2); before it, null until the first
// reading arrives. Lint before AGP 9.6 resolves `extensionVersion` on the compiled class to its backing field, so it
// misses this check (#2016).
@SuppressLint("RequiresWindowSdk")
private fun WindowInfoTracker.currentPosture(context: Context): Posture? {
    if (WindowSdkExtensions.getInstance().extensionVersion >= 9) {
        return getCurrentWindowLayoutInfo(context).posture()
    }
    return null
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
