package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.adaptive.allVerticalHingeBounds
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/**
 * Material's dropdown menu, anchored like Material's to the layout it sits in (a `Box` around the
 * button that opens it). Material opens it from the anchor's start, or from its end where the start
 * would leave the window. Beside an unfolded book foldable's fold, it also opens from the anchor's
 * end where opening from its start could reach the fold, so it stays on the anchor's page.
 */
@Composable
fun DropdownMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    scrollState: ScrollState = rememberScrollState(),
    content: @Composable ColumnScope.() -> Unit,
) {
    val direction = LocalLayoutDirection.current
    val folds = currentWindowAdaptiveInfoV2().windowPosture.allVerticalHingeBounds
    val reach = with(LocalDensity.current) { WIDEST_MENU.toPx() }
    var anchor by remember { mutableStateOf<Rect?>(null) }
    val fromEnd by remember(folds, reach, direction) {
        derivedStateOf { anchor?.let { at -> folds.any { it.reachedFromStart(at, reach, direction) } } == true }
    }

    if (folds.isNotEmpty()) Spacer(Modifier.onGloballyPositioned { anchor = it.parentLayoutCoordinates?.boundsInWindow() })

    // Material picks its placement by the layout direction it's given, so the menu is placed as the
    // other direction would place it, and its items keep the page's direction.
    val placedAs =
        when {
            !fromEnd -> direction
            direction == LayoutDirection.Ltr -> LayoutDirection.Rtl
            else -> LayoutDirection.Ltr
        }
    CompositionLocalProvider(LocalLayoutDirection provides placedAs) {
        androidx.compose.material3.DropdownMenu(expanded, onDismissRequest, modifier, scrollState = scrollState) {
            CompositionLocalProvider(LocalLayoutDirection provides direction) { content() }
        }
    }
}

/** Whether a menu [reach] wide, opened from the start of an [anchor] on one side of this fold, would reach it. */
private fun Rect.reachedFromStart(
    anchor: Rect,
    reach: Float,
    direction: LayoutDirection,
): Boolean =
    if (direction == LayoutDirection.Ltr) {
        anchor.right <= left && anchor.left + reach > left
    } else {
        anchor.left >= right && anchor.right - reach < right
    }

/** Material caps a menu item's width at 280dp. */
private val WIDEST_MENU = 280.dp
