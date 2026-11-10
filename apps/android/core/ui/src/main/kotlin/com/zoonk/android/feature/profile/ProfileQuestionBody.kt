package com.zoonk.android.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.maxTextLength
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.CheckList
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.SelectionChip
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
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
        },
    )

@Composable
fun profileQuestionDescription(
    question: ProfileQuestion,
    supportNext: Boolean = false,
): String =
    stringResource(
        when (question) {
            ProfileQuestion.WORK -> {
                R.string.profile_questions_work_description
            }

            ProfileQuestion.TOOLS -> {
                R.string.profile_questions_tools_description
            }

            ProfileQuestion.STUDIES -> {
                R.string.profile_questions_studies_description
            }

            ProfileQuestion.CONDITIONS -> {
                if (supportNext) R.string.profile_questions_conditions_next else R.string.profile_questions_conditions_description
            }

            ProfileQuestion.LEARNING_SUPPORT -> {
                R.string.profile_questions_support_description
            }

            else -> {
                R.string.profile_questions_interest_description
            }
        },
    )

@Composable
fun ProfileQuestionBody(
    question: ProfileQuestionView,
    draft: ProfileDraft,
    onChange: (ProfileDraft) -> Unit,
    enabled: Boolean = true,
    memoryEnabled: Boolean = true,
    role: String? = null,
    suggested: Boolean = false,
) {
    var atCap by rememberSaveable(question.id) { mutableStateOf(false) }
    var noteOpen by rememberSaveable(question.id) { mutableStateOf(false) }
    val change: (ProfileDraft) -> Unit = {
        atCap = false
        onChange(it)
    }
    val pick: (String) -> Unit = { id ->
        if (id !in draft.picks && draft.picks.size == 3) atCap = true else change(draft.toggle(id))
    }
    val choices = question.options.map { Choice(it.id, it.label, it.description) }
    val label = profileQuestionTitle(question.id)
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        when (question.id) {
            ProfileQuestion.WORK -> {
                ChoiceList(
                    choices = choices + Choice("_declined", stringResource(R.string.profile_questions_prefer_not)),
                    value = if (draft.declined) "_declined" else draft.picks.firstOrNull(),
                    label = label,
                    readOnly = !enabled,
                    onChange = { id ->
                        if (id == "_declined") {
                            change(ProfileDraft(declined = true))
                        } else {
                            change(
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
                                ) { change(draft.copy(text = it, declined = false)) }
                            }
                        }
                    },
                )
            }

            ProfileQuestion.CONDITIONS -> {
                val declined = if (draft.declineChoice == "prefer") "_prefer" else "_none"
                CheckList(
                    choices =
                        choices +
                            listOf(
                                Choice("_none", stringResource(R.string.profile_questions_none)),
                                Choice("_prefer", stringResource(R.string.profile_questions_prefer_not)),
                            ),
                    value = draft.picks + if (draft.declined) listOf(declined) else emptyList(),
                    label = label,
                    readOnly = !enabled,
                    onToggle = { id ->
                        when (id) {
                            "_none" -> change(draft.decline())
                            "_prefer" -> change(draft.decline("prefer"))
                            else -> change(draft.toggle(id).copy(consented = false))
                        }
                    },
                    afterChoice = { id ->
                        if (id == "other" && id in draft.picks) {
                            NestedProfileField {
                                ProfileText(draft.text, R.string.profile_questions_condition_note, 120, enabled) {
                                    change(draft.copy(text = it, declined = false, consented = false))
                                }
                            }
                        }
                    },
                )
                if (draft.picks.isNotEmpty()) {
                    ListDivider(Modifier.bleed(LIST_ITEM_INSET))
                    CheckList(
                        choices =
                            listOf(
                                Choice(
                                    "consent",
                                    stringResource(R.string.profile_questions_consent),
                                    stringResource(R.string.profile_questions_consent_help),
                                ),
                            ),
                        value = if (draft.consented) listOf("consent") else emptyList(),
                        label = stringResource(R.string.profile_questions_consent),
                        readOnly = !enabled,
                        onToggle = { change(draft.copy(consented = !draft.consented)) },
                    )
                }
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
                    choices = choices + Choice("_none", stringResource(R.string.profile_questions_nothing_particular)),
                    value = draft.picks + if (draft.declined) listOf("_none") else emptyList(),
                    label = label,
                    readOnly = !enabled,
                    onToggle = { id -> change(if (id == "_none") draft.decline() else draft.toggle(id)) },
                )
                if (memoryEnabled) {
                    if (noteOpen || draft.text.isNotEmpty()) {
                        ProfileText(
                            draft.text,
                            R.string.profile_questions_support_note,
                            300,
                            enabled,
                            placeholder = R.string.profile_questions_support_placeholder,
                            help = R.string.profile_questions_support_note_help,
                        ) { change(draft.copy(text = it, declined = false)) }
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
                    question.options.forEach { option -> ProfileChip(option.label, option.id in draft.picks, enabled) { pick(option.id) } }
                }
                if (atCap) {
                    Text(
                        stringResource(R.string.profile_questions_cap),
                        Modifier.semantics {
                            liveRegion = LiveRegionMode.Polite
                        },
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                if (question.id == ProfileQuestion.STUDIES) {
                    ProfileChip(
                        stringResource(R.string.profile_questions_nothing_to_add),
                        draft.declined,
                        enabled,
                    ) { change(draft.decline()) }
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
                        ProfileField(draft.subjects[id].orEmpty(), field, 80, enabled, R.string.profile_questions_subject_placeholder) {
                            change(draft.copy(subjects = draft.subjects + (id to it), declined = false))
                        }
                    }
                } else {
                    val (field, placeholder) = favoritesWords(question.id)
                    ProfileText(draft.text, field, 120, enabled, placeholder) { change(draft.copy(text = it, declined = false)) }
                    ProfileChip(stringResource(R.string.profile_questions_none), draft.declined, enabled) { change(draft.decline()) }
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
    placeholder: Int? = null,
    help: Int? = null,
    onChange: (String) -> Unit,
) {
    ProfileField(value, stringResource(label), limit, enabled, placeholder, help, onChange)
}

@Composable
private fun ProfileField(
    value: String,
    label: String,
    limit: Int,
    enabled: Boolean,
    placeholder: Int? = null,
    help: Int? = null,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value,
        { onChange(it.take(limit)) },
        Modifier.fillMaxWidth().semantics { maxTextLength = limit },
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
