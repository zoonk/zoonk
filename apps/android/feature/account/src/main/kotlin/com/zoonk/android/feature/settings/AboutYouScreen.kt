package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.profile.ProfileDraft
import com.zoonk.android.feature.profile.ProfileQuestionBody
import com.zoonk.android.feature.profile.ProfileQuestionsStore
import com.zoonk.android.feature.profile.profileQuestionDescription
import com.zoonk.android.feature.profile.profileQuestionTitle
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.PageHeader
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestions
import kotlinx.coroutines.launch

@Composable
fun AboutYouScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val state by app.profileQuestions.questions.collectShown()
    ProfilePage(navigator, stringResource(R.string.profile_questions_title)) {
        PageHeader(
            stringResource(R.string.profile_questions_title),
            stringResource(R.string.profile_questions_description),
            Modifier.padding(horizontal = LIST_ITEM_INSET),
        )
        when (val shown = state) {
            is LoadState.Loaded -> AboutYouRows(shown.value, navigator)
            is LoadState.Failed -> LoadFailedMessage(onRetry = { app.scope.launch { app.profileQuestions.questions.refresh() } })
            else -> PageLoading()
        }
    }
}

@Composable
private fun AboutYouRows(
    view: ProfileQuestions,
    navigator: AppNavigator,
) {
    if (!view.memoryEnabled) {
        Box(Modifier.padding(horizontal = LIST_ITEM_INSET)) { MemoryOffNotice(navigator) }
    }
    val groups =
        listOf(
            R.string.profile_questions_your_day to view.questions.take(3),
            R.string.profile_questions_for_fun to view.questions.drop(3).take(5),
            R.string.profile_questions_how_learn to view.questions.takeLast(2),
        )
    groups.forEach { (title, questions) ->
        Column {
            SectionHeader(stringResource(title), Modifier.padding(horizontal = LIST_ITEM_INSET))
            questions.forEachIndexed { index, question ->
                if (index > 0) ListDivider()
                ListRow(
                    headline = { Text(profileRowTitle(question.id)) },
                    supporting = { Text(profileSummary(question), maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    enabled = view.memoryEnabled || question.id in listOf(ProfileQuestion.CONDITIONS, ProfileQuestion.LEARNING_SUPPORT),
                    onClick = { navigator.open(AppRoute.ProfileQuestionEdit(question.id.value)) },
                )
            }
        }
    }
}

@Composable
private fun profileRowTitle(question: ProfileQuestion): String =
    stringResource(
        when (question) {
            ProfileQuestion.WORK -> R.string.profile_questions_row_work
            ProfileQuestion.TOOLS -> R.string.profile_questions_row_tools
            ProfileQuestion.STUDIES -> R.string.profile_questions_row_studies
            ProfileQuestion.WATCH -> R.string.profile_questions_row_watch
            ProfileQuestion.LISTEN -> R.string.profile_questions_row_listen
            ProfileQuestion.PLAY -> R.string.profile_questions_row_play
            ProfileQuestion.READ -> R.string.profile_questions_row_read
            ProfileQuestion.ACTIVITIES -> R.string.profile_questions_row_activities
            ProfileQuestion.CONDITIONS -> R.string.profile_questions_row_conditions
            ProfileQuestion.LEARNING_SUPPORT -> R.string.profile_questions_row_support
        },
    )

@Composable
private fun profileSummary(question: ProfileQuestionView): String {
    if (question.status == ProfileQuestionView.Status.DECLINED) return stringResource(R.string.profile_questions_not_shared)
    if (question.id == ProfileQuestion.CONDITIONS &&
        question.saved.picks.isNotEmpty()
    ) {
        return pluralStringResource(R.plurals.profile_questions_conditions_saved, question.saved.picks.size, question.saved.picks.size)
    }
    val labels = question.options.associate { it.id to it.label }
    val selected =
        if (question.id ==
            ProfileQuestion.STUDIES
        ) {
            question.saved.studies.map { it.subject ?: labels[it.field].orEmpty() }
        } else {
            question.saved.picks.mapNotNull { labels[it] }
        }
    val labelsSummary = selected.joinToString(", ")
    val summary =
        when (question.id) {
            ProfileQuestion.WORK -> question.saved.text.ifBlank { labelsSummary }
            ProfileQuestion.STUDIES -> labelsSummary
            ProfileQuestion.LEARNING_SUPPORT -> labelsSummary.ifBlank { question.saved.text }
            else -> factsLine(labelsSummary, question.saved.text)
        }
    return summary.ifEmpty {
        stringResource(
            if (question.status ==
                ProfileQuestionView.Status.ANSWERED
            ) {
                R.string.profile_questions_add
            } else {
                R.string.profile_questions_not_answered
            },
        )
    }
}

@Composable
fun ProfileQuestionScreen(
    id: String,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val state by app.profileQuestions.questions.collectShown()
    ProfilePage(navigator, stringResource(R.string.profile_questions_title)) {
        when (val shown = state) {
            is LoadState.Loaded -> {
                val question = shown.value.questions.find { it.id.value == id }
                if (question != null) {
                    val editor = viewModel(key = id) { ProfileQuestionViewModel(app.profileQuestions, question, createSavedStateHandle()) }
                    PageHeader(
                        profileQuestionTitle(question.id),
                        profileQuestionDescription(question.id),
                        Modifier.padding(horizontal = LIST_ITEM_INSET),
                    )
                    Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        val canEdit =
                            shown.value.memoryEnabled || question.id in listOf(ProfileQuestion.CONDITIONS, ProfileQuestion.LEARNING_SUPPORT)
                        if (!canEdit) {
                            MemoryOffNotice(navigator)
                        }
                        ProfileQuestionBody(
                            question,
                            editor.draft,
                            editor::change,
                            enabled = canEdit && !editor.saving,
                            memoryEnabled = shown.value.memoryEnabled,
                        )
                        if (editor.failed) {
                            Text(
                                stringResource(R.string.onboarding_save_failed),
                                Modifier.semantics {
                                    liveRegion =
                                        LiveRegionMode.Polite
                                },
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                        val empty = editor.draft.empty(question.id, shown.value.memoryEnabled)
                        val valid = empty || editor.draft.valid(question.id, shown.value.memoryEnabled)
                        val consent = question.id != ProfileQuestion.CONDITIONS || editor.draft.picks.isEmpty() || editor.draft.consented
                        Button(
                            onClick = { editor.save(question.id, shown.value.memoryEnabled) { navigator.back() } },
                            busy = editor.saving,
                            enabled =
                                canEdit && valid && consent && !editor.saving,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(stringResource(R.string.settings_save))
                        }
                    }
                } else {
                    NotFoundMessage(onGoHome = { navigator.showRoot(com.zoonk.android.navigation.AppTab.Today) })
                }
            }

            is LoadState.Failed -> {
                LoadFailedMessage(onRetry = { app.scope.launch { app.profileQuestions.questions.refresh() } })
            }

            else -> {
                PageLoading()
            }
        }
    }
}

@Composable
private fun MemoryOffNotice(navigator: AppNavigator) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.profile_questions_memory_off),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(
            onClick = { navigator.open(AppRoute.Memory) },
            size = ButtonSize.Small,
        ) { Text(stringResource(R.string.settings_memory)) }
    }
}

internal class ProfileQuestionViewModel(
    private val store: ProfileQuestionsStore,
    question: ProfileQuestionView,
    handle: SavedStateHandle,
) : ViewModel() {
    private var saved by handle.saved { ProfileDraft.from(question).takeUnless { question.id == ProfileQuestion.CONDITIONS } }
    var draft by mutableStateOf(saved ?: ProfileDraft.from(question))
        private set
    private val privateConditions = question.id == ProfileQuestion.CONDITIONS
    var saving by mutableStateOf(false)
        private set
    var failed by mutableStateOf(false)
        private set

    fun change(value: ProfileDraft) {
        draft = value
        if (!privateConditions) saved = value
    }

    fun save(
        question: ProfileQuestion,
        memoryEnabled: Boolean,
        onSaved: () -> Unit,
    ) {
        if (saving) return
        saving = true
        failed = false
        val answer = if (draft.empty(question, memoryEnabled)) draft.copy(declined = true) else draft
        viewModelScope.launch {
            when (store.answer(answer.input(question, memoryEnabled))) {
                is MutationResult.Done -> onSaved()
                MutationResult.Obsolete -> Unit
                is MutationResult.Failed -> failed = true
            }
            saving = false
        }
    }
}

@Composable
private fun ProfilePage(
    navigator: AppNavigator,
    title: String,
    content: @Composable () -> Unit,
) {
    PageScaffold(onBack = { navigator.back() }, title = { Text(title) }) { padding ->
        BeforeFold {
            Box(
                it
                    .fillMaxSize()
                    .padding(padding)
                    .consumeWindowInsets(padding)
                    .imePadding()
                    .verticalScroll(rememberScrollState()),
                contentAlignment = Alignment.TopCenter,
            ) {
                Column(
                    Modifier.widthIn(max = 640.dp).fillMaxWidth().padding(vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    content()
                }
            }
        }
    }
}
