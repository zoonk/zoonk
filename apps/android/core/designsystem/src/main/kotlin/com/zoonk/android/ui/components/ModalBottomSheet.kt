package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SheetState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import com.zoonk.android.ui.scaffold.HoldUntilFoldsRead
import com.zoonk.android.ui.scaffold.screenSplit

/**
 * Material's modal bottom sheet. Across an unfolded book foldable's fold, or a spread's split on a
 * wide window ([screenSplit]), it sits on the page after it, as the open iPhone Duo moves its sheets,
 * instead of centered across it: a sheet opened from a lesson then covers the learner's turn and
 * leaves the question in view.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModalBottomSheet(
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    sheetState: SheetState = rememberModalBottomSheetState(),
    content: @Composable ColumnScope.() -> Unit,
) {
    val window =
        with(LocalDensity.current) {
            LocalWindowInfo.current.containerSize.width
                .toDp()
        }
    val fold = screenSplit(window)

    androidx.compose.material3.ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        // Material centers the sheet in the window; half the fold's end moves it onto the page after it.
        modifier = if (fold == null) modifier else modifier.offset(x = fold.end / 2),
        sheetState = sheetState,
        sheetMaxWidth =
            if (fold ==
                null
            ) {
                BottomSheetDefaults.SheetMaxWidth
            } else {
                minOf(BottomSheetDefaults.SheetMaxWidth, window - fold.end)
            },
    ) {
        HoldUntilFoldsRead()
        content()
    }
}
