package com.zoonk.android.feature.mock.runner

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.TooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.PopupPositionProvider
import androidx.core.content.edit
import com.zoonk.android.R
import com.zoonk.android.app.LocalSnackbarAnchors
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.theme.zoonk
import kotlin.math.roundToInt

/**
 * Main's Not sure toggle: the same words on and off, a bookmark that fills and turns amber when on. The first
 * time it's turned on, on this device, [tip] says what it's for above the bar, without stopping anything. Where
 * the learner can't go back ([forwardOnly]), it doesn't ask them to check the answer again.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun UnsureButton(
    on: Boolean,
    tip: TooltipState,
    forwardOnly: Boolean,
    onClick: () -> Unit,
) {
    val bar = LocalSnackbarAnchors.current
    var top by remember { mutableFloatStateOf(Float.NaN) }

    TooltipBox(
        positionProvider = rememberAboveBarPosition { (top - (bar.highest ?: top)).takeIf { it.isFinite() } ?: 0f },
        tooltip = {
            RichTooltip(
                caretShape = TooltipDefaults.caretShape(),
                colors = TooltipDefaults.richTooltipColors(contentColor = MaterialTheme.colorScheme.onSurface),
            ) {
                Text(stringResource(if (forwardOnly) R.string.mock_not_sure_tip_forward_only else R.string.mock_not_sure_tip))
            }
        },
        state = tip,
        // It shows only on the press that first turns Not sure on, never on a hover, a long press or focus.
        enableUserInput = false,
    ) {
        OutlinedButton(
            onClick = onClick,
            modifier =
                Modifier.onPlaced { top = it.positionInRoot().y }.semantics {
                    role = Role.Switch
                    toggleableState = ToggleableState(on)
                },
            leadingIcon = { ButtonIcon(if (on) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark) },
            colors =
                ButtonDefaults.outlinedButtonColors(
                    contentColor = if (on) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurface,
                ),
            border = if (on) BorderStroke(1.dp, MaterialTheme.zoonk.warning) else ButtonDefaults.outlinedButtonBorder(enabled = true),
        ) {
            Text(stringResource(R.string.mock_not_sure))
        }
    }
}

/**
 * Above the whole bottom bar, so the bar's top and whatever sits on it stay in view, centered on the button where the
 * window has room. [lift] is how far the button's top is below the bar's, which the popup's anchor doesn't know.
 */
@Composable
private fun rememberAboveBarPosition(lift: () -> Float): PopupPositionProvider {
    val density = LocalDensity.current
    val gap = with(density) { TIP_GAP.roundToPx() }
    val margin = with(density) { TIP_MARGIN.roundToPx() }
    val currentLift by rememberUpdatedState(lift)
    return remember(gap, margin) {
        object : PopupPositionProvider {
            override fun calculatePosition(
                anchorBounds: IntRect,
                windowSize: IntSize,
                layoutDirection: LayoutDirection,
                popupContentSize: IntSize,
            ): IntOffset {
                val centered = anchorBounds.center.x - popupContentSize.width / 2
                val x = centered.coerceIn(margin, (windowSize.width - margin - popupContentSize.width).coerceAtLeast(margin))
                val barTop = anchorBounds.top - currentLift().roundToInt()
                return IntOffset(x, barTop - gap - popupContentSize.height)
            }
        }
    }
}

// Room for the caret, which draws below the tip, and a little air under it.
private val TIP_GAP = 12.dp
private val TIP_MARGIN = 16.dp

/** Whether this device has shown the Not sure tip, kept on it. */
internal class UnsureTipSeen(
    context: Context,
) {
    private val preferences = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /** True only the first time it's asked on this device. */
    fun markFirstTime(): Boolean {
        if (preferences.getBoolean(KEY, false)) return false
        preferences.edit { putBoolean(KEY, true) }
        return true
    }

    private companion object {
        const val FILE = "mock"
        const val KEY = "not_sure_tip_seen"
    }
}

@Composable
internal fun rememberUnsureTipSeen(): UnsureTipSeen {
    val context = LocalContext.current
    return remember(context) { UnsureTipSeen(context) }
}
