package com.zoonk.android.feature.activities.code

import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf10
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf9
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf10Value as PatternAnswerValue
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf9Value as OutputAnswerValue

fun outputAnswer(output: String): ActivityAnswer =
    OutputAnswerValue(LessonStepAnswerOneOf3AnswerOneOf9(LessonStepAnswerOneOf3AnswerOneOf9.Kind.OUTPUT, output))

val ActivityAnswer?.output: String? get() = (this as? OutputAnswerValue)?.value?.output

fun patternAnswer(pattern: String): ActivityAnswer =
    PatternAnswerValue(LessonStepAnswerOneOf3AnswerOneOf10(LessonStepAnswerOneOf3AnswerOneOf10.Kind.PATTERN, pattern))

val ActivityAnswer?.pattern: String? get() = (this as? PatternAnswerValue)?.value?.pattern
