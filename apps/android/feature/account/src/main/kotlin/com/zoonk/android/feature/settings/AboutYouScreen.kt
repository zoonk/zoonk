package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fitInside
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.WindowInsetsRulers
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.profile.ProfileDraft
import com.zoonk.android.feature.profile.ProfileQuestionBody
import com.zoonk.android.feature.profile.ProfileQuestionsStore
import com.zoonk.android.feature.profile.profileQuestionDescription
import com.zoonk.android.feature.profile.profileQuestionTitle
import com.zoonk.android.feature.profile.splitProfileFavorites
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
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
import com.zoonk.android.ui.scaffold.BottomBar
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestions
import kotlinx.coroutines.launch

@Composable
fun AboutYouScreen(
    app: AppContainer,
    navigator: AppNavigator,
    store: ProfileQuestionsStore = app.profileQuestions,
) {
    val state by store.questions.collectShown()
    ProfilePage(navigator, stringResource(R.string.profile_questions_title)) {
        PageHeader(
            stringResource(R.string.profile_questions_title),
            stringResource(R.string.profile_questions_description),
            Modifier.padding(horizontal = LIST_ITEM_INSET),
        )
        when (val shown = state) {
            is LoadState.Loaded -> AboutYouRows(shown.value, navigator)
            is LoadState.Failed -> LoadFailedMessage(onRetry = { app.scope.launch { store.questions.refresh() } })
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
    ABOUT_YOU_GROUPS.forEach { (title, ids) ->
        val questions = ids.mapNotNull { id -> view.questions.find { it.id == id } }
        Column {
            SectionHeader(stringResource(title), Modifier.padding(horizontal = LIST_ITEM_INSET))
            questions.forEachIndexed { index, question ->
                if (index > 0) ListDivider()
                ListRow(
                    headline = { Text(profileRowTitle(question.id)) },
                    supporting = { Text(profileSummary(question), maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    enabled = view.memoryEnabled || question.id in HOW_YOU_LEARN,
                    onClick = { navigator.open(AppRoute.ProfileQuestionEdit(question.id.value)) },
                )
            }
        }
    }
}

private val HOW_YOU_LEARN = listOf(ProfileQuestion.ADDRESS_FORM, ProfileQuestion.CONDITIONS, ProfileQuestion.LEARNING_SUPPORT)

private val ABOUT_YOU_GROUPS =
    listOf(
        R.string.profile_questions_your_day to listOf(ProfileQuestion.WORK, ProfileQuestion.STUDIES, ProfileQuestion.TOOLS),
        R.string.profile_questions_for_fun to
            listOf(ProfileQuestion.WATCH, ProfileQuestion.LISTEN, ProfileQuestion.PLAY, ProfileQuestion.READ, ProfileQuestion.ACTIVITIES),
        R.string.profile_questions_how_learn to HOW_YOU_LEARN,
    )

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
            ProfileQuestion.ADDRESS_FORM -> R.string.profile_questions_row_address
        },
    )

@Composable
private fun profileSummary(question: ProfileQuestionView): String {
    if (question.status == ProfileQuestionView.Status.DECLINED) return stringResource(R.string.profile_questions_not_shared)
    if (question.id == ProfileQuestion.ADDRESS_FORM && question.saved.picks.isNotEmpty()) {
        return stringResource(R.string.profile_questions_saved)
    }
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
            ProfileQuestion.TOOLS -> (selected + splitProfileFavorites(question.saved.text)).joinToString(", ")
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
    store: ProfileQuestionsStore = app.profileQuestions,
) {
    val state by store.questions.collectShown()
    val fresh =
        store.questions.freshState
            .collectAsStateWithLifecycle()
            .value
    val editorState =
        when {
            state !is LoadState.Loaded -> state
            fresh is LoadState.Failed -> LoadState.Failed(fresh.error)
            fresh !is LoadState.Loaded -> LoadState.Loading
            else -> state
        }
    val loaded = (editorState as? LoadState.Loaded)?.value
    val question = loaded?.questions?.find { it.id.value == id }
    val editor = viewModel(key = id) { ProfileQuestionViewModel(store, question, createSavedStateHandle()) }
    VisitOf(editor.visit)
    ActOn(editor.answered) { navigator.back() }
    val memoryEnabled = loaded?.memoryEnabled == true
    val canEdit = memoryEnabled || question?.id in HOW_YOU_LEARN
    ProfilePage(
        navigator,
        stringResource(R.string.profile_questions_title),
        bar =
            if (question != null) {
                {
                    if (editor.failed) {
                        Text(
                            stringResource(R.string.onboarding_save_failed),
                            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                    Button(
                        onClick = { editor.save(question.id, memoryEnabled) },
                        busy = editor.saving,
                        enabled =
                            canEdit && editor.canSave(memoryEnabled) && !editor.saving &&
                                editor.source == question,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(stringResource(R.string.settings_save))
                    }
                }
            } else {
                null
            },
    ) {
        when {
            question != null -> {
                LaunchedEffect(question) { editor.read(question) }
                PageHeader(
                    profileQuestionTitle(question.id),
                    profileQuestionDescription(question.id, inSettings = true),
                    Modifier.padding(horizontal = LIST_ITEM_INSET),
                )
                Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    if (!canEdit) {
                        MemoryOffNotice(navigator)
                    }
                    key(editor.source) {
                        ProfileQuestionBody(
                            question,
                            editor.draft,
                            editor::change,
                            enabled = canEdit && !editor.saving && editor.source == question,
                            memoryEnabled = memoryEnabled,
                            inSettings = true,
                        )
                    }
                }
            }

            loaded != null -> {
                NotFoundMessage(onGoHome = { navigator.showRoot(com.zoonk.android.navigation.AppTab.Today) })
            }

            editorState is LoadState.Failed -> {
                LoadFailedMessage(onRetry = { app.scope.launch { store.questions.refresh() } })
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
    question: ProfileQuestionView?,
    handle: SavedStateHandle,
) : ViewModel() {
    private var saved by handle.saved<ProfileDraft?> { null }
    var draft by mutableStateOf(saved ?: question?.let(ProfileDraft::from) ?: ProfileDraft())
        private set
    var source by mutableStateOf(question)
        private set
    private var edited = saved != null
    var saving by mutableStateOf(false)
        private set

    /** This visit to the question: what its save leads to shows only on it. */
    val visit = Visit()

    /** The answer saved: the page goes back. */
    val answered = visit.outcome<Unit>()

    private val failure = visit.outcome<Unit>()

    /** The answer didn't save, on this visit. */
    val failed get() = failure.value != null

    fun read(question: ProfileQuestionView) {
        if (!edited) draft = ProfileDraft.from(question)
        source = question
    }

    fun change(value: ProfileDraft) {
        edited = true
        draft = value
        if (source?.id != ProfileQuestion.CONDITIONS) saved = value
    }

    fun canSave(memoryEnabled: Boolean): Boolean {
        val question = source ?: return false
        val sent = draft.submitted(question)
        if (!sent.empty(question.id, memoryEnabled)) return sent.valid(question.id, memoryEnabled)
        return question.status == ProfileQuestionView.Status.ANSWERED ||
            (sent.declined && (question.id == ProfileQuestion.WORK || question.id == ProfileQuestion.ADDRESS_FORM))
    }

    fun save(
        question: ProfileQuestion,
        memoryEnabled: Boolean,
    ) {
        val source = source
        if (saving || source?.id != question || !canSave(memoryEnabled)) return
        saving = true
        failure.clear()
        val submitted = draft.submitted(source)
        val answer = if (submitted.empty(question, memoryEnabled)) submitted.copy(declined = true) else submitted
        val started = visit.number
        viewModelScope.launch {
            when (store.answer(answer.input(question, memoryEnabled))) {
                is MutationResult.Done -> answered.send(started, Unit)
                MutationResult.Obsolete -> Unit
                is MutationResult.Failed -> failure.send(started, Unit)
            }
            saving = false
        }
    }
}

@Composable
private fun ProfilePage(
    navigator: AppNavigator,
    title: String,
    bar: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    PageScaffold(onBack = { navigator.back() }, title = { Text(title) }, columnWidth = SETTINGS_COLUMN_WIDTH) { padding ->
        BeforeFold {
            Column(
                it
                    .fillMaxSize()
                    .padding(padding)
                    .consumeWindowInsets(padding)
                    // Above the keyboard by where the page sits, over the tab bar it covers; the bar then adds no keyboard room again.
                    .fitInside(WindowInsetsRulers.Ime.current)
                    .consumeWindowInsets(WindowInsets.ime),
            ) {
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    Column(
                        Modifier.settingsColumn(),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        content()
                    }
                }
                if (bar != null) {
                    BottomBar(columnWidth = PAGE_WIDTH, content = bar)
                }
            }
        }
    }
}

private val PAGE_WIDTH = 640.dp
