package com.zoonk.android.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.CheckList
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ObserveEdits
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.SelectionChip
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.fitTo
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView

@Composable
fun profileQuestionTitle(question: ProfileQuestion): String =
    when (question) {
        ProfileQuestion.UNKNOWN_DEFAULT_OPEN_API -> null
        ProfileQuestion.WORK -> R.string.profile_questions_work_title
        ProfileQuestion.TOOLS -> R.string.profile_questions_tools_title
        ProfileQuestion.STUDIES -> R.string.profile_questions_studies_title
        ProfileQuestion.WATCH -> R.string.profile_questions_watch_title
        ProfileQuestion.LISTEN -> R.string.profile_questions_listen_title
        ProfileQuestion.PLAY -> R.string.profile_questions_play_title
        ProfileQuestion.READ -> R.string.profile_questions_read_title
        ProfileQuestion.ACTIVITIES -> R.string.profile_questions_activities_title
        ProfileQuestion.CONDITIONS -> R.string.profile_questions_conditions_title
        ProfileQuestion.LEARNING_SUPPORT -> R.string.profile_questions_support_title
        ProfileQuestion.ADDRESS_FORM -> R.string.profile_questions_address_title
    }?.let { stringResource(it) }.orEmpty()

/** [inSettings] drops "in Settings" from the lines that point there, as main's Settings page does. */
@Composable
fun profileQuestionDescription(
    question: ProfileQuestion,
    inSettings: Boolean = false,
): String? {
    val line =
        when (question) {
            ProfileQuestion.WORK -> {
                R.string.profile_questions_work_description
            }

            ProfileQuestion.STUDIES -> {
                R.string.profile_questions_studies_description
            }

            ProfileQuestion.CONDITIONS -> {
                if (inSettings) {
                    R.string.profile_questions_conditions_description_settings
                } else {
                    R.string.profile_questions_conditions_description
                }
            }

            ProfileQuestion.LEARNING_SUPPORT -> {
                R.string.profile_questions_support_description
            }

            else -> {
                null
            }
        }
    return line?.let { stringResource(it) }
}

@Composable
fun ProfileQuestionBody(
    question: ProfileQuestionView,
    draft: ProfileDraft,
    onChange: (ProfileDraft) -> Unit,
    enabled: Boolean = true,
    memoryEnabled: Boolean = true,
    role: String? = null,
    suggested: Boolean = false,
    declineAsSkip: Boolean = false,
    inSettings: Boolean = false,
) {
    var noteOpen by rememberSaveable(question.id) { mutableStateOf(false) }
    val choices = question.options.map { Choice(it.id, it.label, it.description) }
    val label = profileQuestionTitle(question.id)
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        when (question.id) {
            ProfileQuestion.WORK -> {
                ChoiceList(
                    choices =
                        choices +
                            listOfNotNull(
                                Choice("_declined", stringResource(R.string.profile_questions_prefer_not)).takeUnless { declineAsSkip },
                            ),
                    value = if (draft.declined) "_declined" else draft.picks.firstOrNull(),
                    label = label,
                    readOnly = !enabled,
                    onChange = { id ->
                        if (id == "_declined") {
                            onChange(ProfileDraft(declined = true))
                        } else {
                            onChange(
                                draft.copy(
                                    picks = listOf(id),
                                    text = draft.text.takeIf { id in listOf("work", "workAndStudy") }.orEmpty(),
                                    declined = false,
                                ),
                            )
                        }
                    },
                    afterChoice = { id ->
                        if (id in draft.picks && id in listOf("work", "workAndStudy")) {
                            NestedProfileField {
                                ProfileText(
                                    draft.text,
                                    R.string.profile_questions_job,
                                    80,
                                    enabled,
                                    placeholder = R.string.profile_questions_job_placeholder,
                                    help = R.string.profile_questions_earlier_answer.takeIf { role != null && draft.text == role },
                                ) { onChange(draft.copy(text = it, declined = false)) }
                            }
                        }
                    },
                )
            }

            ProfileQuestion.ADDRESS_FORM -> {
                ChoiceList(
                    choices =
                        choices +
                            listOfNotNull(
                                Choice("_declined", stringResource(R.string.profile_questions_prefer_not)).takeUnless { declineAsSkip },
                            ),
                    value = if (draft.declined) "_declined" else draft.picks.firstOrNull(),
                    label = label,
                    readOnly = !enabled,
                    onChange = { id ->
                        onChange(
                            if (id ==
                                "_declined"
                            ) {
                                ProfileDraft(declined = true)
                            } else {
                                ProfileDraft(picks = listOf(id))
                            },
                        )
                    },
                )
            }

            ProfileQuestion.CONDITIONS -> {
                val note = remember { FocusRequester() }
                var focusNote by remember { mutableStateOf(false) }
                CheckList(
                    choices = choices,
                    value = draft.picks,
                    label = label,
                    readOnly = !enabled,
                    onToggle = { id ->
                        focusNote = id == "other" && id !in draft.picks && draft.text.isBlank()
                        onChange(draft.toggle(id))
                    },
                    afterChoice = { id ->
                        if (id == "other" && id in draft.picks) {
                            NestedProfileField {
                                ProfileText(
                                    draft.text,
                                    R.string.profile_questions_condition_note,
                                    120,
                                    enabled,
                                    modifier = Modifier.focusRequester(note),
                                ) { onChange(draft.copy(text = it, declined = false)) }
                            }
                            if (focusNote) {
                                LaunchedEffect(Unit) {
                                    note.requestFocus()
                                    focusNote = false
                                }
                            }
                        }
                    },
                )
            }

            ProfileQuestion.LEARNING_SUPPORT -> {
                if (suggested) {
                    Text(
                        stringResource(R.string.profile_questions_suggested),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                CheckList(
                    choices = choices,
                    value = draft.picks,
                    label = label,
                    readOnly = !enabled,
                    onToggle = { id -> onChange(draft.toggle(id)) },
                )
                if (memoryEnabled) {
                    if (noteOpen || draft.text.isNotEmpty()) {
                        ProfileText(
                            draft.text,
                            R.string.profile_questions_support_note,
                            300,
                            enabled,
                            placeholder = R.string.profile_questions_support_placeholder,
                            help =
                                if (inSettings) {
                                    R.string.profile_questions_support_note_help_settings
                                } else {
                                    R.string.profile_questions_support_note_help
                                },
                        ) { onChange(draft.copy(text = it, declined = false)) }
                    } else {
                        TextButton(
                            onClick = { noteOpen = true },
                            enabled = enabled,
                        ) { Text(stringResource(R.string.profile_questions_something_else)) }
                    }
                }
            }

            else -> {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    question.options.forEach { option ->
                        ProfileChip(option.label, option.id in draft.picks, enabled) { onChange(draft.toggle(option.id)) }
                    }
                }
                if (question.id == ProfileQuestion.TOOLS) {
                    TypedTools(question, draft, enabled, onChange)
                } else if (question.id == ProfileQuestion.STUDIES) {
                    draft.picks.forEach { id ->
                        val field =
                            if (id ==
                                "other"
                            ) {
                                stringResource(R.string.profile_questions_which_field)
                            } else {
                                stringResource(
                                    R.string.profile_questions_subject,
                                    question.options
                                        .first {
                                            it.id ==
                                                id
                                        }.label,
                                )
                            }
                        key(id) {
                            ProfileField(
                                draft.subjects[id].orEmpty(),
                                field,
                                80,
                                enabled,
                                placeholder = R.string.profile_questions_subject_placeholder,
                            ) {
                                onChange(draft.copy(subjects = draft.subjects + (id to it), declined = false))
                            }
                        }
                    }
                } else {
                    val (field, placeholder) = favoritesWords(question.id)
                    ProfileText(
                        draft.text,
                        field,
                        120,
                        enabled,
                        placeholder = placeholder,
                    ) { onChange(draft.copy(text = it, declined = false)) }
                }
            }
        }
    }
}

@Composable
private fun ProfileChip(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    SelectionChip(
        text = label,
        selected = selected,
        enabled = enabled,
        onClick = onClick,
        modifier = Modifier.defaultMinSize(minHeight = 48.dp),
    )
}

/** The tools field: what the learner adds by name becomes a picked chip under it, never above, so nothing they see moves. */
@Composable
private fun TypedTools(
    question: ProfileQuestionView,
    draft: ProfileDraft,
    enabled: Boolean,
    onChange: (ProfileDraft) -> Unit,
) {
    val field = remember { TextFieldState(draft.text) }
    // The draft with every change sent so far: an edit or an Add that lands before the parent shows the last change
    // builds on it, since this composition's draft would drop the chips that change made.
    val latest = remember { LatestDraft(draft) }
    SideEffect { latest.draft = draft }
    val canAdd = draft.copy(text = field.text.toString()).canAdd(question.options)
    val send = { next: ProfileDraft ->
        latest.draft = next
        onChange(next)
    }
    val show = { next: ProfileDraft ->
        if (next.text != field.text.toString()) field.setTextAndPlaceCursorAtEnd(next.text)
        send(next)
    }
    val add = {
        val entry = latest.draft.copy(text = field.text.toString())
        entry.canAdd(question.options).also { if (it) show(entry.added(question.options)) }
    }
    field.ObserveEdits { text -> if (text != latest.draft.text) show(latest.draft.typing(text, question.options)) }
    val newest = remember { BringIntoViewRequester() }
    var shownTyped by remember { mutableIntStateOf(draft.typed.size) }
    LaunchedEffect(draft.typed.size) {
        // A tool just added shows above the action bar, even while the keyboard covers the screen's lower half.
        if (draft.typed.size > shownTyped) newest.bringIntoView()
        shownTyped = draft.typed.size
    }
    OutlinedTextField(
        field,
        Modifier.fillMaxWidth(),
        inputTransformation =
            InputTransformation {
                val original = originalText.toString()
                val edited = asCharSequence().toString()
                val previous = latest.draft.copy(text = original)
                if (previous.typing(edited, question.options) === previous) revertAllChanges()
            },
        enabled = enabled,
        label = stringResource(R.string.profile_questions_tools_other),
        placeholder = { Text(stringResource(R.string.profile_questions_tools_placeholder)) },
        trailingIcon = {
            TextButton(
                onClick = { add() },
                enabled = enabled && canAdd,
                size = ButtonSize.Small,
            ) { Text(stringResource(R.string.profile_questions_add)) }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        onKeyboardAction = { performDefault -> if (!add()) performDefault() },
        lineLimits = TextFieldLineLimits.SingleLine,
    )
    if (draft.typed.isNotEmpty()) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            draft.typed.forEachIndexed { index, tool ->
                val remove = { send(latest.draft.removing(tool)) }
                val name = stringResource(R.string.profile_questions_remove_tool, tool)
                SelectionChip(
                    text = tool,
                    selected = true,
                    enabled = enabled,
                    onClick = remove,
                    trailingIcon = {
                        Icon(
                            painterResource(R.drawable.ic_close),
                            contentDescription = null,
                            Modifier.size(FilterChipDefaults.IconSize * LocalDensity.current.fontScale),
                        )
                    },
                    // The whole chip removes the tool, so TalkBack reads it as that one action.
                    modifier =
                        Modifier
                            .defaultMinSize(minHeight = 48.dp)
                            .then(if (index == draft.typed.lastIndex) Modifier.bringIntoViewRequester(newest) else Modifier)
                            .clearAndSetSemantics {
                                contentDescription = name
                                role = Role.Button
                                onClick {
                                    remove()
                                    true
                                }
                                if (!enabled) disabled()
                            },
                )
            }
        }
    }
}

@Composable
private fun NestedProfileField(content: @Composable () -> Unit) {
    Box(Modifier.padding(start = LIST_ITEM_INSET * 2, end = LIST_ITEM_INSET, bottom = 16.dp)) { content() }
}

@Composable
private fun ProfileText(
    value: String,
    label: Int,
    limit: Int,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    placeholder: Int? = null,
    help: Int? = null,
    onChange: (String) -> Unit,
) {
    ProfileField(value, stringResource(label), limit, enabled, modifier, placeholder, help, onChange)
}

@Composable
private fun ProfileField(
    value: String,
    label: String,
    limit: Int,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    placeholder: Int? = null,
    help: Int? = null,
    onChange: (String) -> Unit,
) {
    val field = remember { TextFieldState(value) }
    field.ObserveEdits(onChange)
    OutlinedTextField(
        state = field,
        inputTransformation = InputTransformation.fitTo(limit),
        modifier = modifier.fillMaxWidth(),
        enabled = enabled,
        label = label,
        placeholder = placeholder?.let { { Text(stringResource(it)) } },
        supportingText = help?.let { { Text(stringResource(it)) } },
    )
}

private fun favoritesWords(question: ProfileQuestion): Pair<Int, Int> =
    when (question) {
        ProfileQuestion.TOOLS -> R.string.profile_questions_tools_other to R.string.profile_questions_tools_placeholder
        ProfileQuestion.WATCH -> R.string.profile_questions_watch_favorites to R.string.profile_questions_watch_placeholder
        ProfileQuestion.LISTEN -> R.string.profile_questions_listen_favorites to R.string.profile_questions_listen_placeholder
        ProfileQuestion.PLAY -> R.string.profile_questions_play_favorites to R.string.profile_questions_play_placeholder
        ProfileQuestion.READ -> R.string.profile_questions_read_favorites to R.string.profile_questions_read_placeholder
        else -> R.string.profile_questions_activities_favorites to R.string.profile_questions_activities_placeholder
    }

private class LatestDraft(
    var draft: ProfileDraft,
)
