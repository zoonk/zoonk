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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.semantics.maxTextLength
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
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.SelectionChip
import com.zoonk.android.ui.components.TextButton
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView

@Composable
fun profileQuestionTitle(question: ProfileQuestion): String =
    stringResource(
        when (question) {
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
        },
    )

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
    val canAdd = draft.canAdd(question.options)
    val add = { onChange(draft.added(question.options)) }
    val newest = remember { BringIntoViewRequester() }
    var shownTyped by remember { mutableIntStateOf(draft.typed.size) }
    LaunchedEffect(draft.typed.size) {
        // A tool just added shows above the action bar, even while the keyboard covers the screen's lower half.
        if (draft.typed.size > shownTyped) newest.bringIntoView()
        shownTyped = draft.typed.size
    }
    OutlinedTextField(
        draft.text,
        { onChange(draft.typing(it, question.options)) },
        Modifier.fillMaxWidth(),
        enabled = enabled,
        label = stringResource(R.string.profile_questions_tools_other),
        placeholder = { Text(stringResource(R.string.profile_questions_tools_placeholder)) },
        trailingIcon = {
            TextButton(
                onClick = add,
                enabled = enabled && canAdd,
                size = ButtonSize.Small,
            ) { Text(stringResource(R.string.profile_questions_add)) }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { if (canAdd) add() else defaultKeyboardAction(ImeAction.Done) }),
        singleLine = true,
    )
    if (draft.typed.isNotEmpty()) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            draft.typed.forEachIndexed { index, tool ->
                val remove = { onChange(draft.removing(tool)) }
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
    OutlinedTextField(
        value,
        { onChange(it.take(limit)) },
        modifier.fillMaxWidth().semantics { maxTextLength = limit },
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
