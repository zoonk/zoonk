package com.zoonk.android.feature.activities.code

import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf9
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf9Value as OutputAnswerValue

fun outputAnswer(output: String): ActivityAnswer =
    OutputAnswerValue(LessonStepAnswerOneOf3AnswerOneOf9(LessonStepAnswerOneOf3AnswerOneOf9.Kind.OUTPUT, output))

val ActivityAnswer?.output: String? get() = (this as? OutputAnswerValue)?.value?.output
