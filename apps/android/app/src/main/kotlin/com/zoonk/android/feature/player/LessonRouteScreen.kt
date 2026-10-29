package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonOutline
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.scaffold.TaskScaffold
import kotlinx.coroutines.launch

/** `/learn/{lessonId}`: the lesson's screens, its outline while it waits to be written, or a visitor's way in. */
@Composable
fun LessonRouteScreen(
    route: AppRoute.Lesson,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val resource = remember(route.lessonId) { app.lessonPlayer.lesson(route.lessonId) }
    val load by resource.collectShown()
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = session is SessionState.SignedIn
    val scope = rememberCoroutineScope()
    val exits =
        remember(navigator) {
            object : LessonPlayerExits {
                override fun close() = navigator.closeTask()

                override fun open(route: AppRoute) = navigator.open(route)

                override fun replace(route: AppRoute) {
                    navigator.closeTask()
                    if (route == AppRoute.Today) navigator.showRoot(AppTab.Today) else navigator.open(route)
                }
            }
        }

    when (val state = load) {
        LoadState.Idle, LoadState.Loading -> {
            LessonFrame(title = null, onClose = exits::close) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
        }

        is LoadState.Failed -> {
            LessonFrame(title = null, onClose = exits::close) {
                if (state.error == ApiError.NotFound) {
                    LessonAccessScreen(LessonRefusal.NotFound, onRetry = {}, exits = exits)
                } else {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
                }
            }
        }

        LoadState.Empty -> {
            LessonFrame(title = null, onClose = exits::close) {
                LessonAccessScreen(LessonRefusal.NotFound, onRetry = {}, exits = exits)
            }
        }

        is LoadState.Loaded -> {
            when (val lesson = state.value) {
                is LessonLoad.Ready -> {
                    PlayingLesson(route, app, lesson, exits)
                }

                is LessonLoad.SessionRequired -> {
                    GuestGate(lesson.outline, app, navigator, exits)
                }

                is LessonLoad.NotGenerated -> {
                    if (signedIn) {
                        WaitingLesson(
                            route,
                            app,
                            lesson.outline,
                            exits,
                        )
                    } else {
                        GuestGate(lesson.outline, app, navigator, exits)
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayingLesson(
    route: AppRoute.Lesson,
    app: AppContainer,
    load: LessonLoad.Ready,
    exits: LessonPlayerExits,
) {
    val viewModel =
        viewModel(key = "lesson:${route.lessonId}") {
            LessonPlayerViewModel(
                lessonId = route.lessonId,
                studySessionId = route.sessionId,
                firstAnswer = route.firstAnswer,
                store = app.lessonPlayer,
                cache = app.cache,
                sessions = app.sessions,
                choices = app.todayChoices,
                isGuest = { (app.sessions.state.value as? SessionState.SignedIn)?.isGuest == true },
                activeGoalId = {
                    app.learnerSummary.summary.state.value.value
                        ?.activeGoalId
                        ?.toString()
                },
            )
        }
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.session
    val state by viewModel.state.collectAsStateWithLifecycle()
    val ending by viewModel.ending.collectAsStateWithLifecycle()
    val profile by app.learningProfile.profile.collectShown()

    LaunchedEffect(load.lesson.id, signedIn) { viewModel.open(load.lesson) }

    CompositionLocalProvider(LocalPrivatePictures provides PrivatePictures(app.images, signedIn)) {
        LessonPlayer(load.lesson, state, ending, viewModel, exits)
        LessonSounds(state, enabled = profile.value?.soundsEnabled ?: true)
    }
}

/** A task's frame for what shows before the lesson's screens: its title, and leaving. */
@Composable
internal fun LessonFrame(
    title: String?,
    onClose: () -> Unit,
    bottomBar: (@Composable () -> Unit)? = null,
    scrolls: Boolean = true,
    content: @Composable () -> Unit,
) {
    TaskScaffold(
        onClose = onClose,
        title = { title?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        bottomBar = bottomBar,
    ) { padding ->
        val scroll = if (scrolls) Modifier.verticalScroll(rememberScrollState()) else Modifier
        Box(Modifier.fillMaxSize().padding(padding).then(scroll)) { content() }
    }
}

/**
 * A lesson's screens load, and a lesson is written, only with a session, so a visitor opens it as a
 * guest at once (main's `LessonGuestGate`); the guest keeps everything if they make an account later.
 */
@Composable
private fun GuestGate(
    outline: LessonOutline,
    app: AppContainer,
    navigator: AppNavigator,
    exits: LessonPlayerExits,
) {
    var attempt by rememberSaveable { mutableStateOf(0) }
    var failed by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(attempt) {
        failed = false
        val result = app.sessions.signIn(asGuest = true) { app.lessonPlayer.api.createGuest() }
        failed = result is SignInResult.Failed
    }

    LessonFrame(
        title = outline.title,
        onClose = exits::close,
        bottomBar =
            if (failed) {
                {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        FilledTonalButton(onClick = { navigator.open(AppRoute.Login) }, modifier = Modifier.weight(1f)) {
                            Text(stringResource(R.string.gate_log_in))
                        }
                        Button(onClick = { attempt++ }, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.player_try_again)) }
                    }
                }
            } else {
                null
            },
    ) {
        LessonColumn(Modifier.padding(vertical = 24.dp)) {
            Text(outline.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
            if (failed) {
                Text(
                    stringResource(R.string.player_open_failed),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                Row(
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    Text(stringResource(R.string.player_opening_lesson), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun WaitingLesson(
    route: AppRoute.Lesson,
    app: AppContainer,
    outline: LessonOutline,
    exits: LessonPlayerExits,
) {
    val resource = app.lessonPlayer.lesson(route.lessonId)
    val viewModel =
        viewModel(key = "writing:${route.lessonId}") {
            LessonWritingViewModel(
                lessonId = route.lessonId,
                store = app.lessonPlayer,
                writingApi = LiveLessonWritingApi(app.api),
                generations = { LiveGenerationSource(app.api, it) },
                cache = app.cache,
                sessions = app.sessions,
            )
        }
    val session by app.sessions.state.collectAsStateWithLifecycle()

    LaunchedEffect((session as? SessionState.SignedIn)?.session) { viewModel.open() }

    LessonWaitingScreen(outline, viewModel, exits, readLesson = resource::refresh)
}
