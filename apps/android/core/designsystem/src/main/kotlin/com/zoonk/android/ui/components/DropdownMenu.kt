package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.adaptive.allVerticalHingeBounds
import androidx.compose.material3.adaptive.separatingHorizontalHingeBounds
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
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.scaffold.windowAdaptiveInfo

/**
 * Material's dropdown menu, anchored like Material's to the layout it sits in (a `Box` around the
 * button that opens it), and kept on its button's side of an unfolded book foldable's fold: beside a
 * book's fold it opens toward the side of the page with more room and is no wider than that room,
 * and on a tabletop it is no taller than the room on the button's half, scrolling when its items
 * don't fit. Material's own placement does the rest.
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
    val density = LocalDensity.current
    val posture = windowAdaptiveInfo().windowPosture
    val bookFolds = posture.allVerticalHingeBounds
    val tabletopFolds = posture.separatingHorizontalHingeBounds
    val window = LocalWindowInfo.current.containerSize
    val systemBars = WindowInsets.systemBars
    val keyboard = WindowInsets.ime
    var anchor by remember { mutableStateOf<Rect?>(null) }
    var menuHeight by remember { mutableStateOf<Int?>(null) }
    val placement by remember(bookFolds, tabletopFolds, window, systemBars, keyboard, direction, density) {
        derivedStateOf {
            val at = anchor ?: return@derivedStateOf null
            val room =
                bookFolds.firstNotNullOfOrNull { it.roomBeside(at, window.width.toFloat(), direction) }
                    ?: tabletopFolds.firstNotNullOfOrNull { fold ->
                        with(density) {
                            // Material keeps a menu its margin inside the window's visible frame, which the bars and the keyboard
                            // leave, measuring from the window's top.
                            val margin = MATERIAL_MENU_MARGIN.toPx()
                            val visible =
                                window.height - systemBars.getTop(this) - maxOf(systemBars.getBottom(this), keyboard.getBottom(this))
                            fold.roomOnHalf(at, margin, visible - margin, MENU_ROOM.toPx())
                        }
                    }
                    ?: return@derivedStateOf null
            // Material opens a menu below its button wherever it fits in the window, so one that opens upward is placed
            // that far up: by its height, or until it's measured, by all its room.
            val height = room.height ?: 0f
            val lift = if (room.upward) at.height + minOf(menuHeight?.toFloat() ?: height, height) else 0f
            room to lift
        }
    }
    val room = placement?.first
    val lift = placement?.second ?: 0f

    if (bookFolds.isNotEmpty() || tabletopFolds.isNotEmpty()) {
        Spacer(Modifier.onGloballyPositioned { anchor = it.parentLayoutCoordinates?.boundsInWindow() })
    }

    // Material opens a menu from its button's start in the layout direction it's given, so the menu is
    // placed in the direction it opens toward, and its items keep the page's direction.
    val placedAs = room?.rightward?.let { if (it) LayoutDirection.Ltr else LayoutDirection.Rtl } ?: direction
    with(density) {
        val bounds = Modifier.sizeIn(maxWidth = room?.width?.toDp() ?: Dp.Unspecified, maxHeight = room?.height?.toDp() ?: Dp.Unspecified)
        CompositionLocalProvider(LocalLayoutDirection provides placedAs) {
            androidx.compose.material3.DropdownMenu(
                expanded = expanded,
                onDismissRequest = onDismissRequest,
                modifier = bounds.onSizeChanged { menuHeight = it.height }.then(modifier),
                offset = DpOffset(0.dp, -lift.toDp()),
                scrollState = scrollState,
            ) {
                CompositionLocalProvider(LocalLayoutDirection provides direction) { content() }
            }
        }
    }
}

/**
 * Where a menu fits beside a fold: which way it opens from its button (toward the window's right or
 * left, or up), and how wide or tall it can be there; null keeps Material's choice.
 */
internal data class MenuRoom(
    val rightward: Boolean? = null,
    val width: Float? = null,
    val height: Float? = null,
    val upward: Boolean = false,
)

/**
 * The room on the page an [anchor] sits on beside this vertical fold, in a [window] that wide, or
 * null where the anchor crosses it. With as much room either way, the menu opens from the button's
 * start, as Material's does.
 */
internal fun Rect.roomBeside(
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

    return MenuRoom(rightward = rightward, width = if (rightward) toRight else toLeft)
}

/**
 * The room on the half an [anchor] sits on beside this horizontal fold, or null where the anchor
 * crosses it. Material opens a menu below its button where it fits between [materialTop] and
 * [materialBottom], and above it otherwise. Over the fold, the menu drops down to the fold, unless
 * that leaves less than [usable] and there's more room above, where it opens upward. Under the fold,
 * either of Material's choices stays under it within the larger of the two rooms.
 */
internal fun Rect.roomOnHalf(
    anchor: Rect,
    materialTop: Float,
    materialBottom: Float,
    usable: Float,
): MenuRoom? {
    val below: Float
    val above: Float
    when {
        anchor.bottom <= top -> {
            below = top - anchor.bottom
            above = anchor.top - materialTop
        }

        anchor.top >= bottom -> {
            return MenuRoom(height = maxOf(materialBottom - anchor.bottom, anchor.top - bottom))
        }

        else -> {
            return null
        }
    }
    return if (below < usable && above > below) MenuRoom(height = above, upward = true) else MenuRoom(height = below)
}

/** Material's `MenuVerticalMargin`, which it keeps between a menu and its window's top and bottom. */
private val MATERIAL_MENU_MARGIN = 48.dp

/** One of Material's 48dp items with the menu's padding: less room than this is no menu. */
private val MENU_ROOM = 64.dp
