package com.zoonk.android.feature.language

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.LanguageTodayPronunciation
import com.zoonk.api.models.LanguageUnitsAlphabet
import com.zoonk.api.models.TodayPattern
import kotlinx.coroutines.launch
import java.util.UUID

internal class AlphabetSkipModel(
    private val store: AlphabetStore,
) : ViewModel() {
    var skipping by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    fun skip(goalId: UUID) {
        viewModelScope.launch {
            skipping = true
            failed = false
            failed = store.skipAlphabet(goalId) is MutationResult.Failed
            skipping = false
        }
    }
}

/**
 * The alphabet lesson for a script the learner's language doesn't use, above the Plan's path. While
 * the next session still opens with it, "I can already read it" takes it out.
 */
@Composable
fun AlphabetRow(
    alphabet: LanguageUnitsAlphabet,
    goalId: UUID,
    store: AlphabetStore,
    open: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    val model = viewModel(key = "alphabet-skip:$goalId") { AlphabetSkipModel(store) }
    val time = formatMinutes(alphabet.minutes.toInt(), currentLocale())

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ListItem(
            headlineContent = { Text(alphabet.title) },
            supportingContent = {
                Text(
                    stringResource(
                        if (alphabet.pending) R.string.language_alphabet_first_next_session else R.string.language_alphabet_anytime,
                        time,
                    ),
                )
            },
            leadingContent = { Icon(painterResource(R.drawable.ic_translate), contentDescription = null) },
            modifier = Modifier.clickable { open(AppRoute.Lesson(alphabet.lessonId.toString())) },
            colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
        )
        if (alphabet.pending) {
            OutlinedButton(onClick = { model.skip(goalId) }, enabled = !model.skipping) {
                Text(stringResource(R.string.language_alphabet_skip))
            }
            if (model.failed) {
                Text(
                    stringResource(R.string.language_alphabet_skip_failed),
                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

fun hasLanguagePractice(
    pattern: TodayPattern?,
    pronunciation: LanguageTodayPronunciation?,
): Boolean = pronunciation != null || pattern != null

/** Today's one language notice (main's `LanguagePracticeRow`): words to say again first, else the pattern noticed in recent mistakes. */
@Composable
fun LanguagePracticeNotice(
    goalId: UUID,
    pattern: TodayPattern?,
    pronunciation: LanguageTodayPronunciation?,
    layout: SuggestionLayout,
    open: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    when {
        pronunciation != null -> {
            val title = pluralStringResource(R.plurals.language_say_again, pronunciation.count.toInt(), pronunciation.count.toInt())
            PracticeNotice(
                label = title,
                summary = title,
                description = formatList(pronunciation.words, currentLocale()),
                action = stringResource(R.string.language_say_them),
                mark = SuggestionMark.Symbol(R.drawable.ic_mic),
                layout = layout,
                modifier = modifier,
            ) { open(AppRoute.Pronunciation(goalId.toString())) }
        }

        pattern?.kind == TodayPattern.Kind.TYPOS -> {
            val slips = stringResource(R.string.language_pattern_typos_description)
            PracticeNotice(
                label = stringResource(R.string.language_pattern_typos),
                summary = slips,
                description = slips,
                action = stringResource(R.string.language_typos_open),
                mark = SuggestionMark.Symbol(R.drawable.ic_keyboard),
                layout = layout,
                modifier = modifier,
            ) { open(AppRoute.Pattern(pattern.id.toString())) }
        }

        pattern != null -> {
            PracticeNotice(
                label = stringResource(R.string.language_pattern_noticed),
                summary = stringResource(R.string.language_pattern_noticed_summary, pattern.title),
                description = pattern.title,
                action = stringResource(R.string.language_pattern_practice),
                mark = SuggestionMark.New,
                layout = layout,
                modifier = modifier,
            ) { open(AppRoute.Pattern(pattern.id.toString())) }
        }
    }
}

@Composable
private fun PracticeNotice(
    label: String,
    summary: String,
    description: String,
    action: String,
    mark: SuggestionMark,
    layout: SuggestionLayout,
    modifier: Modifier,
    onOpen: () -> Unit,
) {
    Suggestion(
        label = label,
        summary = summary,
        layout = layout,
        modifier = modifier,
        mark = mark,
        lineAction = { SuggestionAction(action, onOpen, secondary = true) },
    ) {
        SuggestionHeader(label)
        SuggestionDescription(description)
        SuggestionActions {
            SuggestionAction(
                action,
                {
                    close()
                    onOpen()
                },
                secondary = true,
            )
        }
    }
}
