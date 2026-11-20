package com.zoonk.android.feature.mock.runner

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.TooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.dp
import androidx.core.content.edit
import com.zoonk.android.R
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.theme.zoonk

/**
 * Main's Not sure toggle: the same words on and off, a bookmark that fills and turns amber when on. The first
 * time it's turned on, on this device, [tip] says what it's for beside it, without stopping anything.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun UnsureButton(
    on: Boolean,
    tip: TooltipState,
    onClick: () -> Unit,
) {
    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = { RichTooltip { Text(stringResource(R.string.mock_not_sure_tip)) } },
        state = tip,
    ) {
        OutlinedButton(
            onClick = onClick,
            modifier =
                Modifier.semantics {
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
