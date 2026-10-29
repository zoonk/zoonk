package com.zoonk.android.feature.onboarding

import android.view.KeyEvent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.ui.theme.zoonk

data class Choice<T>(
    val value: T,
    val label: String,
    val description: String? = null,
)

/**
 * One row per choice with its radio. [onPick] hears a tap or a number key, so a one-answer question
 * saves at once while the row shows picked, and a Continue during that save can't send it again.
 */
@Composable
fun <T> ChoiceList(
    choices: List<Choice<T>>,
    value: T?,
    label: String,
    onChange: (T) -> Unit,
    modifier: Modifier = Modifier,
    onPick: ((T) -> Unit)? = null,
    readOnly: Boolean = false,
) {
    val choose = { choice: Choice<T> ->
        if (!readOnly) {
            onChange(choice.value)
            onPick?.invoke(choice.value)
        }
    }

    OutlinedCard(
        modifier =
            modifier
                .selectableGroup()
                .semantics { contentDescription = label }
                .onPreviewKeyEvent { event ->
                    val index = event.nativeKeyEvent.keyCode - KeyEvent.KEYCODE_1
                    val choice = choices.getOrNull(index)
                    if (event.type == KeyEventType.KeyUp && index in 0 until NUMBER_KEYS && choice != null) {
                        choose(choice)
                        true
                    } else {
                        false
                    }
                },
    ) {
        Column {
            choices.forEachIndexed { index, choice ->
                if (index > 0) HorizontalDivider()
                val selected = choice.value == value
                ListItem(
                    headlineContent = { Text(choice.label) },
                    supportingContent = choice.description?.let { { Text(it) } },
                    trailingContent = { RadioButton(selected = selected, onClick = null) },
                    colors =
                        ListItemDefaults.colors(
                            containerColor = if (selected) MaterialTheme.zoonk.selectedTint else MaterialTheme.colorScheme.surface,
                        ),
                    modifier = Modifier.selectable(selected = selected, enabled = !readOnly, role = Role.RadioButton) { choose(choice) },
                )
            }
        }
    }
}

private const val NUMBER_KEYS = 9
