package com.zoonk.android.feature.onboarding

import android.view.KeyEvent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk

data class Choice<T>(
    val value: T,
    val label: String,
    val description: String? = null,
)

/** Main's `OnboardingAnnouncer`: the setup reads this out above its steps, so the next step doesn't cut it off. */
val LocalOnboardingAnnounce = staticCompositionLocalOf<(String) -> Unit> { {} }

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
    val announce = LocalOnboardingAnnounce.current
    val resources = LocalResources.current
    val choose = { choice: Choice<T> ->
        if (!readOnly) {
            onChange(choice.value)
            onPick?.let { pick ->
                pick(choice.value)
                announce(resources.getString(R.string.onboarding_you_picked, choice.label))
            }
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

/** Several answers at once, one row per choice with its checkbox; with [max], the other rows are disabled once that many are picked. */
@Composable
fun <T> CheckList(
    choices: List<Choice<T>>,
    value: List<T>,
    label: String,
    onToggle: (T) -> Unit,
    modifier: Modifier = Modifier,
    max: Int? = null,
    readOnly: Boolean = false,
) {
    val full = max != null && value.size >= max

    OutlinedCard(modifier.semantics { contentDescription = label }) {
        choices.forEachIndexed { index, choice ->
            if (index > 0) HorizontalDivider()
            val checked = choice.value in value
            val open = checked || !full
            ListItem(
                headlineContent = { Text(choice.label) },
                supportingContent = choice.description?.let { { Text(it) } },
                trailingContent = { Checkbox(checked = checked, onCheckedChange = null) },
                colors =
                    ListItemDefaults.colors(
                        containerColor = if (checked) MaterialTheme.zoonk.selectedTint else MaterialTheme.colorScheme.surface,
                    ),
                modifier =
                    Modifier
                        .alpha(if (open) 1f else DISABLED_ALPHA)
                        .toggleable(checked, enabled = open && !readOnly, role = Role.Checkbox) { onToggle(choice.value) },
            )
        }
    }
}

private const val NUMBER_KEYS = 9

/** Material's disabled emphasis. */
private const val DISABLED_ALPHA = 0.38f
