package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.LayoutDirection

/**
 * Material's dropdown menu, anchored like Material's to the layout it sits in (a `Box` around the
 * button that opens it). Beside an unfolded book foldable's fold it stays on its button's page: it
 * opens toward the side of the page with more room and is no wider than that room, so Material's
 * own placement, from the button's start or its end, never reaches the fold.
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
    val window =
        LocalWindowInfo.current.containerSize.width
            .toFloat()
    var anchor by remember { mutableStateOf<Rect?>(null) }
    val room by remember(folds, window, direction) {
        derivedStateOf { anchor?.let { at -> folds.firstNotNullOfOrNull { it.roomBeside(at, window, direction) } } }
    }

    if (folds.isNotEmpty()) Spacer(Modifier.onGloballyPositioned { anchor = it.parentLayoutCoordinates?.boundsInWindow() })

    // Material opens a menu from its button's start in the layout direction it's given, so the menu is
    // placed in the direction it opens toward, and its items keep the page's direction.
    val placedAs = room?.let { if (it.rightward) LayoutDirection.Ltr else LayoutDirection.Rtl } ?: direction
    val width = room?.let { Modifier.widthIn(max = with(LocalDensity.current) { it.width.toDp() }) } ?: Modifier
    CompositionLocalProvider(LocalLayoutDirection provides placedAs) {
        androidx.compose.material3.DropdownMenu(expanded, onDismissRequest, width.then(modifier), scrollState = scrollState) {
            CompositionLocalProvider(LocalLayoutDirection provides direction) { content() }
        }
    }
}

/** Which way a menu opens from its button, toward the window's right or left, and how wide it can be there. */
private data class MenuRoom(
    val rightward: Boolean,
    val width: Float,
)

/**
 * The room on the page an [anchor] sits on beside this fold, in a [window] that wide, or null where
 * the anchor crosses it. With as much room either way, the menu opens from the button's start, as
 * Material's does.
 */
private fun Rect.roomBeside(
    anchor: Rect,
    window: Float,
    direction: LayoutDirection,
): MenuRoom? {
    val (pageLeft, pageRight) =
        when {
            anchor.right <= left -> 0f to left
            anchor.left >= right -> right to window
            else -> return null
        }
    val toRight = pageRight - anchor.left
    val toLeft = anchor.right - pageLeft

    val rightward = if (direction == LayoutDirection.Ltr) toRight >= toLeft else toRight > toLeft

    return if (rightward) MenuRoom(rightward = true, toRight) else MenuRoom(rightward = false, toLeft)
}
