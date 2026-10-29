package com.zoonk.android.feature.activities

import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.ActivityExpectedAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf1
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf7
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf1Value as ChoiceAnswerValue
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf7Value as NumericAnswerValue

fun choiceAnswer(optionId: String): ActivityAnswer =
    ChoiceAnswerValue(LessonStepAnswerOneOf3AnswerOneOf1(LessonStepAnswerOneOf3AnswerOneOf1.Kind.CHOICE, optionId))

val ActivityAnswer?.choiceId: String? get() = (this as? ChoiceAnswerValue)?.value?.optionId

fun numericAnswer(value: Double): ActivityAnswer =
    NumericAnswerValue(LessonStepAnswerOneOf3AnswerOneOf7(LessonStepAnswerOneOf3AnswerOneOf7.Kind.NUMERIC, value))

val ActivityAnswer?.numericValue: Double? get() = (this as? NumericAnswerValue)?.value?.`value`

val ActivityExpected?.numericValue: Double? get() = (this as? ActivityExpected.NumericWrapper)?.value?.`value`

val ActivityExpected?.interaction: ActivityExpectedAnswer? get() = (this as? ActivityExpected.InteractionWrapper)?.value?.answer
