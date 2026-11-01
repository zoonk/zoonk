package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.separatingHorizontalHingeBounds
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogWindowProvider
import com.zoonk.android.ui.scaffold.pageFold
import kotlin.math.roundToInt

/**
 * Material's alert dialog. Across an unfolded book foldable's fold its window keeps to the page
 * after the fold, as [ModalBottomSheet] does, and on a tabletop it sits on the flat half with the
 * controls, instead of centered across either fold.
 */
@Composable
fun AlertDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
    title: @Composable (() -> Unit)? = null,
    text: @Composable (() -> Unit)? = null,
) {
    val place = dialogPlace()

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismissRequest,
        // Material's dialog has no slot of its own for its window, and its confirm button is always there.
        confirmButton = {
            place?.let { WindowAt(it) }
            confirmButton()
        },
        modifier = place?.width?.let { Modifier.widthIn(max = it - PAGE_MARGIN * 2) } ?: Modifier,
        dismissButton = dismissButton,
        title = title,
        text = text,
    )
}

/** Material's date picker dialog, off a foldable's fold as [AlertDialog] is. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val place = dialogPlace()

    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismissRequest,
        confirmButton = confirmButton,
        dismissButton = dismissButton,
    ) {
        place?.let { WindowAt(it) }
        content()
    }
}

/** Material's time picker dialog, off a foldable's fold as [AlertDialog] is. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    title: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val place = dialogPlace()

    androidx.compose.material3.TimePickerDialog(
        onDismissRequest = onDismissRequest,
        confirmButton = confirmButton,
        title = title,
        dismissButton = dismissButton,
    ) {
        place?.let { WindowAt(it) }
        content()
    }
}

/**
 * Where a dialog's window sits on a foldable, from the window's middle: on the page after a book's
 * fold, as wide as that page ([width]), or on a tabletop's flat half. Taller than that half, the
 * window stays on screen and keeps its height.
 */
private data class DialogPlace(
    val width: Dp?,
    val x: Dp,
    val y: Dp,
)

@Composable
private fun dialogPlace(): DialogPlace? {
    val density = LocalDensity.current
    val window =
        with(density) {
            LocalWindowInfo.current.containerSize.width
                .toDp()
        }
    pageFold(window)?.let { fold ->
        val towardEnd = if (LocalLayoutDirection.current == LayoutDirection.Ltr) 1 else -1
        return DialogPlace(width = window - fold.end, x = fold.end / 2 * towardEnd, y = 0.dp)
    }
    val tabletop = currentWindowAdaptiveInfoV2().windowPosture.separatingHorizontalHingeBounds.firstOrNull() ?: return null
    return DialogPlace(width = null, x = 0.dp, y = with(density) { (tabletop.bottom / 2).toDp() })
}

/** Material centers a dialog's window in the app's; this moves it to [place] through the window itself, which only the dialog's own content can reach. */
@Composable
private fun WindowAt(place: DialogPlace) {
    val window = (LocalView.current.parent as? DialogWindowProvider)?.window ?: return
    val density = LocalDensity.current

    SideEffect {
        window.attributes =
            window.attributes.apply {
                with(density) {
                    place.width?.let { width = it.toPx().roundToInt() }
                    x = place.x.toPx().roundToInt()
                    y = place.y.toPx().roundToInt()
                }
            }
    }
}

/** A dialog's room on each side within its page, as a phone leaves it beside a dialog. */
private val PAGE_MARGIN = 24.dp
