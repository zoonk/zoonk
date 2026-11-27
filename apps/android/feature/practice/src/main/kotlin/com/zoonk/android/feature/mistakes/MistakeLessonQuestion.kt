package com.zoonk.android.feature.mistakes

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.Resource
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.feedback.rememberSaveFailureReport
import com.zoonk.android.feature.player.LessonStepResultView
import com.zoonk.android.feature.player.LocalLessonSpeech
import com.zoonk.android.feature.player.ResultNext
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.canSelfCorrect
import com.zoonk.android.feature.player.engine.screen
import com.zoonk.android.feature.player.engine.shownStep
import com.zoonk.android.feature.player.language.PromptAudioBarButton
import com.zoonk.android.feature.player.language.PromptAudioEffect
import com.zoonk.android.feature.player.language.rememberLessonLanguage
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.toApi
import com.zoonk.android.feature.player.steps.FillingColumn
import com.zoonk.android.feature.player.steps.LocalBoardMisses
import com.zoonk.android.feature.player.steps.LocalStepViewHeight
import com.zoonk.android.feature.player.steps.LocalWordBankCheck
import com.zoonk.android.feature.player.steps.SpokenRecordAction
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.feature.player.steps.StepKeys
import com.zoonk.android.feature.player.steps.StepView
import com.zoonk.android.feature.player.steps.lessonBarNote
import com.zoonk.android.feature.player.steps.recordsInBar
import com.zoonk.android.feature.player.steps.rememberBoardMisses
import com.zoonk.android.feature.practice.DrillStage
import com.zoonk.android.feature.practice.PAGE_PADDING
import com.zoonk.android.feature.practice.PAGE_SPACING
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
import com.zoonk.android.feature.questions.MistakeNote
import com.zoonk.android.feature.questions.NotSureButton
import com.zoonk.android.feature.tutor.TutorAskButton
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.LocalOptionKeys
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TaskSegment

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
    val screen = lesson.screen()
    val stepKeys = remember { StepKeys() }
    val actions =
        object : StepActions {
            override fun select(answer: LessonAnswer?) = viewModel.selectLesson(answer)

            override fun takeKeyPicks(pick: ((LessonAnswer?) -> Unit)?) = stepKeys.takePicks(pick)

            override fun takeNumberKeys(keys: ((Int) -> Boolean)?) = stepKeys.takeNumbers(keys)

            override fun runPrimary() {
                val current = viewModel.state.value ?: return
                val primary = current.lesson?.screen()?.primary
                when {
                    current.run.stage == DrillStage.Ideas -> viewModel.startDrill()
                    current.run.phase is RunPhase.Checked -> viewModel.next(current.read.questions)
                    primary?.enabled != true -> Unit
                    primary.isCheck -> viewModel.checkLesson()
                    else -> viewModel.continueLesson()
                }
            }

            override fun dontKnow(stepId: String) = viewModel.checkLesson(dontKnow = true)

            override fun explainFirst() = Unit

            override val cantTalk get() = viewModel.cantTalk

            override fun setCantTalk(chosen: Boolean) = viewModel.setCantTalk(chosen)

            override val cantListen get() = viewModel.cantListen

            override fun setCantListen(chosen: Boolean) = viewModel.setCantListen(chosen)

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
    val records = !checked && lesson.phase != LessonPhase.Checking && recordsInBar(task.step, lesson, actions)
    val language = rememberLessonLanguage(task.language, task.targetLanguage, app.speech)
    val promptStep = task.step.takeIf { viewModel.todayChoicesRead && !ideas }
    val boardMisses = rememberBoardMisses(state.run.index)
    language.prompt?.let { PromptAudioEffect(promptStep, lesson, viewModel.cantTalk, viewModel.cantListen, it) }
    RunFrame(
        title = stringResource(R.string.mistakes_practice_title),
        question = null,
        place = state.run.index,
        app = app,
        onClose = viewModel::leave,
        mainAction = actions::runPrimary,
        report = null,
        progress = { MistakeSegments(state) },
        note = if (ideas || checked) null else lessonBarNote(task.step, lesson, actions),
        // As in the lesson, a number key picks what the screen shows while the learner answers.
        onNumberKey = { index ->
            !ideas && !checked && lesson.phase == LessonPhase.Playing && stepKeys.press(task.step, index, lesson, actions::select)
        },
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
                        NotSureButton(
                            onClick = { viewModel.checkLesson(dontKnow = true) },
                            enabled = lesson.phase != LessonPhase.Checking,
                            dontKnowYet = task.drill.kind != Drill.Kind.NoGuessing,
                        )
                    }
                    language.prompt?.let { PromptAudioBarButton(task.step, lesson, actions, it) }
                    if (records) {
                        SpokenRecordAction(task.step, actions, width)
                    } else {
                        Button(
                            onClick = actions::runPrimary,
                            modifier = width,
                            enabled = checked || (primary?.enabled == true && lesson.phase != LessonPhase.Checking),
                            busy = lesson.phase == LessonPhase.Checking,
                        ) {
                            Text(stringResource(primaryLabel))
                        }
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
                        TutorAskButton(scope, app, navigator)
                    }
                }
            }
        },
    ) { part, _, _ ->
        CompositionLocalProvider(
            LocalLessonSpeech provides app.speech,
            LocalBoardMisses provides boardMisses,
            LocalOptionKeys provides true,
        ) {
            if (ideas) {
                if (part.showsScreen) DrillIdeas(task.drill, onOpenLesson = null)
                return@CompositionLocalProvider
            }
            val result: @Composable () -> Unit = {
                lesson.results[task.step.id]?.let {
                    LessonStepResultView(
                        lesson.shownStep(task.step, viewModel.cantTalk, viewModel.cantListen),
                        it,
                        ResultNext(savedMistake = false, willReturn = false),
                        null,
                        notes = {
                            DrillAnswerNotes(
                                task.drill,
                                notSure = state.run.answers[state.run.index]?.blank == true,
                                timedOut = state.run.timedOut,
                                trap = state.lessonGrade?.trap,
                            )
                            (state.run.phase as? RunPhase.Checked)?.let { graded -> MistakeNote(graded.feedback) }
                        },
                    )
                }
            }
            // As in the lesson, a word bank places the verdict itself and the screen's column reaches the actions.
            val inBank = part.showsTurn && task.step.canSelfCorrect
            FillingColumn(
                Modifier
                    .heightIn(min = LocalStepViewHeight.current ?: 0.dp)
                    .padding(bottom = LESSON_BANK_GAP - PAGE_PADDING),
                PAGE_SPACING,
            ) {
                if (part.showsScreen && !checked) {
                    task.drill.timeLimitSeconds?.let { seconds ->
                        DrillCountdown(seconds, { viewModel.checkLesson(dontKnow = true, timedOut = true) })
                    }
                }
                if (part.showsScreen && !task.drill.isIdeaFirst) {
                    DrillNote(task.drill, onOpenLesson = null, answered = checked)
                }
                CompositionLocalProvider(LocalWordBankCheck provides if (inBank) result else null) {
                    StepView(task.step, lesson, screen, actions, navigator, language, part, writingOptions = false)
                }
                if (part.showsTurn && !inBank) result()
            }
        }
    }
}

/** The lesson's gap between a word bank and the actions under it. */
private val LESSON_BANK_GAP = 16.dp
