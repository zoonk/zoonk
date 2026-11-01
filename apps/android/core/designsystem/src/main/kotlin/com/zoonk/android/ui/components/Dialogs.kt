package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.ExperimentalMaterial3Api
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
 * after the fold, as [ModalBottomSheet] does, instead of sitting centered across it.
 */
@Composable
fun AlertDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
    title: @Composable (() -> Unit)? = null,
    text: @Composable (() -> Unit)? = null,
) {
    val page = pageAfterFold()

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismissRequest,
        // Material's dialog has no slot of its own for its window, and its confirm button is always there.
        confirmButton = {
            page?.let { WindowOnPage(it) }
            confirmButton()
        },
        modifier = if (page == null) Modifier else Modifier.widthIn(max = page.width - PAGE_MARGIN * 2),
        dismissButton = dismissButton,
        title = title,
        text = text,
    )
}

/** Material's date picker dialog, on the page after an unfolded book's fold as [AlertDialog] is. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val page = pageAfterFold()

    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismissRequest,
        confirmButton = confirmButton,
        dismissButton = dismissButton,
    ) {
        page?.let { WindowOnPage(it) }
        content()
    }
}

/** Material's time picker dialog, on the page after an unfolded book's fold as [AlertDialog] is. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    title: @Composable () -> Unit,
    dismissButton: @Composable (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val page = pageAfterFold()

    androidx.compose.material3.TimePickerDialog(
        onDismissRequest = onDismissRequest,
        confirmButton = confirmButton,
        title = title,
        dismissButton = dismissButton,
    ) {
        page?.let { WindowOnPage(it) }
        content()
    }
}

/** The page after an unfolded book's fold: its [width], and how far right of the window's middle its own middle sits. */
private data class PageAfterFold(
    val width: Dp,
    val offset: Dp,
)

@Composable
private fun pageAfterFold(): PageAfterFold? {
    val window =
        with(LocalDensity.current) {
            LocalWindowInfo.current.containerSize.width
                .toDp()
        }
    val fold = pageFold(window) ?: return null
    val towardEnd = if (LocalLayoutDirection.current == LayoutDirection.Ltr) 1 else -1
    return PageAfterFold(width = window - fold.end, offset = fold.end / 2 * towardEnd)
}

/** Material centers a dialog's window in the app's; this moves it onto [page] through the window itself, which only the dialog's own content can reach. */
@Composable
private fun WindowOnPage(page: PageAfterFold) {
    val window = (LocalView.current.parent as? DialogWindowProvider)?.window ?: return
    val density = LocalDensity.current

    SideEffect {
        window.attributes =
            window.attributes.apply {
                width = with(density) { page.width.toPx() }.roundToInt()
                x = with(density) { page.offset.toPx() }.roundToInt()
            }
    }
}

/** A dialog's room on each side within its page, as a phone leaves it beside a dialog. */
private val PAGE_MARGIN = 24.dp
