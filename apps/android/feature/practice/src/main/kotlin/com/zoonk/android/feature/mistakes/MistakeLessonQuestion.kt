package com.zoonk.android.feature.mistakes

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.Resource
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.feedback.rememberSaveFailureReport
import com.zoonk.android.feature.player.LessonStepResultView
import com.zoonk.android.feature.player.LocalLessonSpeech
import com.zoonk.android.feature.player.ResultNext
import com.zoonk.android.feature.player.TodayChoice
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.screen
import com.zoonk.android.feature.player.language.rememberLessonLanguage
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.toApi
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.feature.player.steps.StepView
import com.zoonk.android.feature.practice.DrillStage
import com.zoonk.android.feature.practice.RunFrame
import com.zoonk.android.feature.practice.RunMeter
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.DrillAnswerNotes
import com.zoonk.android.feature.questions.DrillCountdown
import com.zoonk.android.feature.questions.DrillIdeas
import com.zoonk.android.feature.questions.DrillNote
import com.zoonk.android.feature.questions.DrillStartButton
import com.zoonk.android.feature.tutor.TutorAskButton
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TaskSegment
import kotlinx.coroutines.launch

@Composable
internal fun MistakeSegments(state: PracticeState) {
    RunMeter(
        state.run.index,
        state.read.tasks.size,
        state.read.tasks.indices.map { index ->
            val answer = state.run.answers[index]
            when {
                answer == null -> if (index == state.run.index) TaskSegment.Current else TaskSegment.Ahead
                answer.blank -> TaskSegment.Read
                answer.isCorrect -> TaskSegment.Right
                else -> TaskSegment.Wrong
            }
        },
    )
}

@Composable
internal fun MistakeLessonQuestion(
    state: PracticeState,
    task: MistakePracticeTask.Lesson,
    viewModel: MistakePracticeViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val lesson = state.lesson ?: return
    var cannotTalk by rememberSaveable { mutableStateOf(false) }
    var cannotListen by rememberSaveable { mutableStateOf(false) }
    val identity = app.sessions.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(identity) {
        if (identity != null) {
            cannotTalk = app.todayChoices.isChosen(identity, TodayChoice.CantTalk)
            cannotListen = app.todayChoices.isChosen(identity, TodayChoice.CantListen)
        }
    }
    val screen = lesson.screen()
    val actions =
        object : StepActions {
            override fun select(answer: LessonAnswer?) = viewModel.selectLesson(answer)

            override fun runPrimary() {
                when {
                    state.run.stage == DrillStage.Ideas -> viewModel.startDrill()
                    state.run.phase is RunPhase.Checked -> viewModel.next(state.read.questions)
                    screen.primary?.enabled != true -> Unit
                    screen.primary?.isCheck == true -> viewModel.checkLesson()
                    else -> viewModel.continueLesson()
                }
            }

            override fun dontKnow(stepId: String) = viewModel.checkLesson(dontKnow = true)

            override fun skipWriting() = Unit

            override fun explainFirst() = Unit

            override val cantTalk get() = cannotTalk

            override fun setCantTalk(chosen: Boolean) {
                cannotTalk = chosen
                identity?.let { scope.launch { app.todayChoices.set(it, TodayChoice.CantTalk, chosen) } }
            }

            override val cantListen get() = cannotListen

            override fun setCantListen(chosen: Boolean) {
                cannotListen = chosen
                identity?.let { scope.launch { app.todayChoices.set(it, TodayChoice.CantListen, chosen) } }
            }

            override suspend fun gradeSpoken(
                stepId: String,
                recording: VoiceRecording,
            ): GradeOutcome<Unit> = viewModel.gradeSpoken(task, recording)

            override fun exampleLine(stepId: String): Resource<String>? = null
        }
    val ideas = state.run.stage == DrillStage.Ideas
    val saveReport = rememberSaveFailureReport(app, "mistake-practice")
    val checked = state.run.phase is RunPhase.Checked
    val primary = screen.primary
    val primaryLabel = if (checked || primary?.isCheck == false) R.string.practice_continue else R.string.practice_check
    RunFrame(
        title = stringResource(R.string.mistakes_practice_title),
        question = null,
        place = state.run.index,
        app = app,
        onClose = viewModel::leave,
        mainAction = actions::runPrimary,
        report = null,
        progress = { MistakeSegments(state) },
        actions = {
            if (ideas) {
                DrillStartButton(viewModel::startDrill)
            } else {
                if (state.run.phase == RunPhase.AnswerFailed) {
                    SaveErrorText(
                        state.run.saveFailures,
                        onRetry = viewModel::retryLesson,
                        onReport = saveReport::open,
                    )
                }
                TaskActions { width ->
                    if (!checked) {
                        com.zoonk.android.ui.components.OutlinedButton(
                            onClick = { viewModel.checkLesson(dontKnow = true) },
                            enabled =
                                lesson.phase != LessonPhase.Checking,
                        ) {
                            Text(
                                stringResource(
                                    if (task.drill.kind ==
                                        Drill.Kind.NoGuessing
                                    ) {
                                        R.string.questions_drill_not_sure
                                    } else {
                                        R.string.questions_dont_know_yet
                                    },
                                ),
                            )
                        }
                    }
                    Button(
                        onClick = actions::runPrimary,
                        modifier = width,
                        enabled = checked || (primary?.enabled == true && lesson.phase != LessonPhase.Checking),
                        busy = lesson.phase == LessonPhase.Checking,
                    ) {
                        Text(stringResource(primaryLabel))
                    }
                    if (task.tutorAvailable) {
                        val given = lesson.answers[task.step.id] ?: lesson.results[task.step.id]?.answerText?.let(LessonAnswer::Spoken)
                        val answer = given?.toApi().takeIf { state.lessonGrade?.lessonResult?.checked == true }
                        val scope =
                            if (answer !=
                                null
                            ) {
                                TutorScope.Answer(task.lessonId, task.step.id, task.step.position + 1, answer, task.mistakeId)
                            } else {
                                TutorScope.Step(task.lessonId, task.step.id, task.step.position + 1, task.mistakeId)
                            }
                        TutorAskButton(scope, app, navigator, worded = checked && state.lessonGrade?.isCorrect == false)
                    }
                }
            }
        },
    ) { part, _, _ ->
        CompositionLocalProvider(LocalLessonSpeech provides app.speech) {
            val language = rememberLessonLanguage(task.language, task.targetLanguage)
            if (ideas) {
                if (part.showsScreen) DrillIdeas(task.drill, onOpenLesson = null)
                return@CompositionLocalProvider
            }
            if (part.showsScreen &&
                !checked
            ) {
                task.drill.timeLimitSeconds?.let { seconds ->
                    DrillCountdown(seconds, { viewModel.checkLesson(dontKnow = true, timedOut = true) })
                }
            }
            if (part.showsScreen && !task.drill.isIdeaFirst) {
                DrillNote(task.drill, onOpenLesson = null, answered = checked)
            }
            StepView(task.step, lesson, screen, actions, navigator, language, part, writingOptions = false)
            if (part.showsTurn) {
                lesson.results[task.step.id]?.let {
                    LessonStepResultView(task.step, it, ResultNext(savedMistake = false, willReturn = false), null)
                    DrillAnswerNotes(
                        task.drill,
                        notSure = state.run.answers[state.run.index]?.blank == true,
                        timedOut = state.run.timedOut,
                        trap = state.lessonGrade?.trap,
                    )
                }
            }
        }
    }
}
