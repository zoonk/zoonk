package com.zoonk.android.feature.tutor

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.limitMessage

@Composable
internal fun askLabel(
    scope: TutorScope,
    name: String,
): String =
    stringResource(
        when (scope) {
            is TutorScope.Chapter -> R.string.tutor_ask_chapter
            is TutorScope.Mock -> R.string.tutor_ask_mock
            is TutorScope.Plan -> R.string.tutor_ask_plan
            is TutorScope.Subject -> R.string.tutor_ask_subject
            is TutorScope.Answer -> R.string.tutor_ask_answer
            is TutorScope.Item -> if (scope.answered) R.string.tutor_ask_answer else R.string.tutor_ask_question
            is TutorScope.Lesson, is TutorScope.Step -> R.string.tutor_ask_screen
        },
        name,
    )

@Composable
internal fun descriptionLabel(scope: TutorScope): String =
    stringResource(
        when (scope) {
            is TutorScope.Answer -> R.string.tutor_description_answer
            is TutorScope.Step -> R.string.tutor_description_step
            is TutorScope.Chapter -> R.string.tutor_description_chapter
            is TutorScope.Lesson -> R.string.tutor_description_lesson
            is TutorScope.Mock -> R.string.tutor_description_mock
            is TutorScope.Plan -> R.string.tutor_description_plan
            is TutorScope.Subject -> R.string.tutor_description_subject
            is TutorScope.Item -> R.string.tutor_description_item
        },
    )

@Composable
internal fun placeholderLabel(scope: TutorScope): String =
    stringResource(
        when (scope) {
            is TutorScope.Chapter -> R.string.tutor_placeholder_chapter
            is TutorScope.Mock -> R.string.tutor_placeholder_mock
            is TutorScope.Plan -> R.string.tutor_placeholder_plan
            is TutorScope.Subject -> R.string.tutor_placeholder_subject
            is TutorScope.Item -> R.string.tutor_placeholder_item
            is TutorScope.Answer -> R.string.tutor_placeholder_answer
            is TutorScope.Lesson, is TutorScope.Step -> R.string.tutor_placeholder_lesson
        },
    )

@Composable
internal fun aboutLabel(about: TutorTurn.About): String =
    stringResource(
        when (about) {
            TutorTurn.About.Answer -> R.string.tutor_about_answer
            TutorTurn.About.Chapter -> R.string.tutor_about_chapter
            TutorTurn.About.Lesson -> R.string.tutor_about_lesson
            TutorTurn.About.Mock -> R.string.tutor_about_mock
            TutorTurn.About.Plan -> R.string.tutor_about_plan
            TutorTurn.About.Step -> R.string.tutor_about_step
            TutorTurn.About.Subject -> R.string.tutor_about_subject
            TutorTurn.About.Item -> R.string.tutor_about_question
        },
    )

@Composable
internal fun failureMessage(failure: TutorFailure?): String {
    failure?.helpLimit?.let { return limitMessage(it, LimitSubject.Help) }

    return stringResource(
        when (failure) {
            TutorFailure.SignedOut -> R.string.tutor_error_session
            TutorFailure.PlusRequired -> R.string.tutor_error_subscription
            TutorFailure.Gone -> R.string.tutor_error_gone
            TutorFailure.Invalid -> R.string.tutor_error_invalid
            is TutorFailure.Refused -> R.string.tutor_error_slow_down
            TutorFailure.Failed, null -> R.string.tutor_error_failed
        },
    )
}
