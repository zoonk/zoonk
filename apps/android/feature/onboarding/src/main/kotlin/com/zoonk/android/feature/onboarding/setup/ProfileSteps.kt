package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.feature.profile.ProfileDraft
import com.zoonk.android.feature.profile.ProfileQuestionBody
import com.zoonk.android.feature.profile.profileJobPrefill
import com.zoonk.android.feature.profile.profileQuestion
import com.zoonk.android.feature.profile.profileQuestionDescription
import com.zoonk.android.feature.profile.profileQuestionTitle
import com.zoonk.android.feature.profile.profileSkip
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.TextButton
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Onboarding
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.ProfileQuestion
import kotlinx.coroutines.launch

@Composable
internal fun ColumnScope.ProfileStep(
    step: OnboardingStep,
    view: Onboarding,
    vm: GoalSetupViewModel,
) {
    val id = step.profileQuestion ?: return
    val question = view.profile.questions.first { it.id == id }
    val role = profileJobPrefill(view.goal.details.text("role"))
    val draft = vm.profileDraft(question, role)
    val scope = rememberCoroutineScope()
    val memory = view.profile.memoryEnabled
    val declinesOnSkip = id == ProfileQuestion.ADDRESS_FORM
    val valid = draft.valid(id, memory)
    val holdsAnswer = draft.declined || !draft.empty(id, memory)
    val save = { vm.answer(draft.onboardingInput(id, memory), profileAnswer = draft) }
    val order = (vm.flow.history + step + view.steps).filter { it.profileQuestion != null }.distinct()
    val wait = LocalSetupWait.current
    var startingLesson by rememberSaveable(id) { mutableStateOf(false) }
    LaunchedEffect(vm.isSaving) { if (!vm.isSaving) startingLesson = false }

    StepForm(
        title = profileQuestionTitle(id),
        description = profileQuestionDescription(id),
        subject = stringResource(R.string.profile_questions_progress, order.indexOf(step) + 1, order.size),
        pending = vm.isSaving,
        canContinue = valid,
        onContinue = { save() },
        onSkip = {
            val declines = declinesOnSkip || id == ProfileQuestion.CONDITIONS
            vm.answer(if (declines) ProfileDraft(declined = true).onboardingInput(id, memory) else profileSkip(id))
        },
        skipLabel = stringResource(R.string.profile_questions_prefer_not).takeIf { declinesOnSkip },
        notice = {
            if (view.goal.kind == Goal.Kind.LEARN && wait.firstLesson?.ready == true && wait.onStartLesson != null) {
                FlowRow(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    itemVerticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        stringResource(R.string.profile_questions_lesson_ready),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TextButton(
                        onClick = {
                            if (holdsAnswer && valid) {
                                startingLesson = true
                                val saving = save()
                                scope.launch { if (saving?.await() is WriteOutcome.Done) wait.onStartLesson.invoke() }
                            } else {
                                wait.onStartLesson.invoke()
                            }
                        },
                        enabled = !vm.isSaving,
                        busy = vm.isSaving && startingLesson,
                        focusableWhenDisabled = vm.isSaving,
                        size = ButtonSize.Small,
                        forward = true,
                    ) {
                        Text(
                            stringResource(
                                if (holdsAnswer &&
                                    valid
                                ) {
                                    R.string.profile_questions_save_start_lesson
                                } else {
                                    R.string.profile_questions_start_lesson
                                },
                            ),
                        )
                    }
                }
            }
        },
    ) {
        ProfileQuestionBody(
            question,
            draft,
            { vm.changeProfile(id, it) },
            enabled = !vm.isSaving,
            memoryEnabled = memory,
            role = role,
            suggested = id == ProfileQuestion.LEARNING_SUPPORT && vm.supportsSuggested,
            declineAsSkip = declinesOnSkip,
        )
    }
}
