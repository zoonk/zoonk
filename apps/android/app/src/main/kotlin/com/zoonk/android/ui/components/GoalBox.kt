package com.zoonk.android.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import java.util.Locale

/** The same limit core applies to a typed goal. */
const val MAX_GOAL_LENGTH = 2000

/**
 * Main's goal box (the landing's and `/start`'s): "I want to …" and Build my plan. [onSubmit] gets
 * the trimmed words; an empty box asks for them unless [canSubmitEmpty] (material and an intent are
 * already chosen). [leading] holds the attach button. Enter sends, as main's box does.
 */
@Composable
fun GoalBox(
    value: String,
    onValueChange: (String) -> Unit,
    onSubmit: (String) -> Unit,
    modifier: Modifier = Modifier,
    note: String? = null,
    canSubmitEmpty: Boolean = false,
    isSubmitting: Boolean = false,
    focusRequester: FocusRequester = remember { FocusRequester() },
    leading: (@Composable () -> Unit)? = null,
) {
    var isAskingForWords by rememberSaveable { mutableStateOf(false) }

    val submit: () -> Unit = {
        val goal = value.trim()

        when {
            isSubmitting -> {}

            goal.isNotEmpty() || canSubmitEmpty -> {
                onSubmit(goal)
            }

            else -> {
                isAskingForWords = true
                focusRequester.requestFocus()
            }
        }
    }

    val line = if (isAskingForWords) stringResource(R.string.goal_box_write_first) else note

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Above the box rather than beside it, where a long goal or a large font wrapped in a narrow strip.
        val label = stringResource(R.string.goal_box_label)
        Text(label, Modifier.clearAndSetSemantics {}, style = MaterialTheme.typography.bodyLarge)

        OutlinedTextField(
            value = value,
            onValueChange = { typed ->
                isAskingForWords = false
                // A typed Enter sends; pasted lines join into one goal.
                if (typed.length == value.length + 1 && typed.endsWith('\n')) {
                    submit()
                } else {
                    onValueChange(typed.replace('\n', ' ').take(MAX_GOAL_LENGTH))
                }
            },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester)
                    .semantics { contentDescription = label },
            readOnly = isSubmitting,
            placeholder = { Text(stringResource(R.string.goal_box_placeholder, spokenLanguage(currentLocale()))) },
            supportingText = line?.let { { Text(it) } },
            isError = isAskingForWords,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { submit() }),
            minLines = 2,
            maxLines = 8,
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            leading?.invoke()
            Spacer(Modifier.weight(1f))
            Button(
                onClick = submit,
                contentPadding = if (isSubmitting) ButtonDefaults.ButtonWithIconContentPadding else ButtonDefaults.ContentPadding,
            ) {
                Text(stringResource(R.string.goal_box_submit))

                if (isSubmitting) {
                    Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                    CircularProgressIndicator(
                        modifier = Modifier.size(ButtonDefaults.IconSize),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                    )
                }
            }
        }
    }
}

data class GoalExample(
    val label: String,
    val kind: String,
)

/** Main's examples under the goal box: a tap sends the example as the goal. */
@Composable
fun GoalExamples(
    examples: List<GoalExample>,
    onPick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        SectionHeader(stringResource(R.string.goal_box_examples))
        Spacer(Modifier.size(8.dp))
        val pickLabel = stringResource(R.string.goal_box_example_pick)
        examples.forEachIndexed { index, example ->
            if (index > 0) HorizontalDivider()
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .clickable(role = Role.Button, onClickLabel = pickLabel) { onPick(example.label) }
                        .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Column(Modifier.weight(1f)) {
                    Text(example.label, style = MaterialTheme.typography.bodyLarge)
                    Text(example.kind, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
                Icon(
                    painterResource(R.drawable.ic_chevron_right),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Main's five examples, with the local exam and a language that isn't the app's own. */
@Composable
fun rememberGoalExamples(): List<GoalExample> {
    val locale = currentLocale()
    val language = spokenLanguage(locale)
    val quickExplanation = stringResource(R.string.goal_box_kind_quick_explanation, formatMinutes(QUICK_EXPLANATION_MINUTES, locale))

    return listOf(
        GoalExample(stringResource(R.string.goal_box_example_exam), stringResource(R.string.goal_box_kind_exam)),
        GoalExample(stringResource(R.string.goal_box_example_language, language), stringResource(R.string.goal_box_kind_language)),
        GoalExample(stringResource(R.string.goal_box_example_topic), stringResource(R.string.goal_box_kind_topic)),
        GoalExample(stringResource(R.string.goal_box_example_music), stringResource(R.string.goal_box_kind_music)),
        GoalExample(stringResource(R.string.goal_box_example_explanation), quickExplanation),
    )
}

/** Mid-sentence, so the name keeps the language's own casing ("inglês", "Spanish"). */
private fun spokenLanguage(locale: Locale): String {
    val spoken = if (locale.language == "en") "es" else "en"
    return Locale.forLanguageTag(spoken).getDisplayLanguage(locale)
}

private const val QUICK_EXPLANATION_MINUTES = 5
