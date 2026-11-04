package com.zoonk.android.ui.components

import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
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
            WindowAt(place)
            confirmButton()
        },
        modifier = place.width?.let { Modifier.widthIn(max = it - PAGE_MARGIN * 2) } ?: Modifier,
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
        WindowAt(place)
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
        WindowAt(place)
        content()
    }
}

/**
 * A dialog over the whole window, drawn behind the system bars. Its window has bars of its own,
 * set up edge to edge as the activity's are, with icons that follow the light or dark theme. It
 * covers the window's snackbars: [content] shows them with a [SnackbarHost] where its layout has
 * room, or they wait until it closes.
 */
@Composable
fun FullScreenDialog(
    onDismissRequest: () -> Unit,
    content: @Composable () -> Unit,
) {
    Dialog(onDismissRequest, DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val view = LocalView.current
        val light = !isSystemInDarkTheme()
        SideEffect {
            val window = (view.parent as? DialogWindowProvider)?.window ?: return@SideEffect
            WindowCompat.enableEdgeToEdge(window)
            WindowCompat.getInsetsController(window, view).run {
                isAppearanceLightStatusBars = light
                isAppearanceLightNavigationBars = light
            }
        }
        SnackbarLayerOver(content)
    }
}

/**
 * Where a dialog's window sits, from the window's middle: on the page after a book's fold, as wide
 * as that page ([width]), on a tabletop's flat half, or in the middle. Taller than that half, the
 * window stays on screen and keeps its height, with its buttons on the flat half.
 */
private data class DialogPlace(
    val width: Dp?,
    val x: Dp,
    val y: Dp,
)

@Composable
private fun dialogPlace(): DialogPlace {
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
    val tabletop = currentWindowAdaptiveInfoV2().windowPosture.separatingHorizontalHingeBounds.firstOrNull()
    return DialogPlace(width = null, x = 0.dp, y = tabletop?.let { with(density) { (it.bottom / 2).toDp() } } ?: 0.dp)
}

/**
 * Material centers a dialog's window in the app's; this moves it to [place] through the window
 * itself, which only the dialog's own content can reach. A book folding flat from a tabletop leaves
 * the dialog open, so it moves back to the middle.
 */
@Composable
private fun WindowAt(place: DialogPlace) {
    val window = (LocalView.current.parent as? DialogWindowProvider)?.window ?: return
    val density = LocalDensity.current

    SideEffect {
        val attributes = window.attributes
        val width = place.width?.let { with(density) { it.toPx().roundToInt() } } ?: attributes.width
        val x = with(density) { place.x.toPx().roundToInt() }
        val y = with(density) { place.y.toPx().roundToInt() }
        if (attributes.width != width || attributes.x != x || attributes.y != y) {
            window.attributes =
                attributes.apply {
                    this.width = width
                    this.x = x
                    this.y = y
                }
        }
    }
}

private val PAGE_MARGIN = 24.dp
