package com.zoonk.android.feature.activities

import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.ActivityExpectedAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf1
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf13
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf7
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf8
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf13Value as SelectionAnswerValue
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf1Value as ChoiceAnswerValue
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf7Value as NumericAnswerValue
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf8Value as OrderAnswerValue
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOfValue as AssignmentAnswerValue

fun choiceAnswer(optionId: String): ActivityAnswer =
    ChoiceAnswerValue(LessonStepAnswerOneOf3AnswerOneOf1(LessonStepAnswerOneOf3AnswerOneOf1.Kind.CHOICE, optionId))

val ActivityAnswer?.choiceId: String? get() = (this as? ChoiceAnswerValue)?.value?.optionId

fun numericAnswer(value: Double): ActivityAnswer =
    NumericAnswerValue(LessonStepAnswerOneOf3AnswerOneOf7(LessonStepAnswerOneOf3AnswerOneOf7.Kind.NUMERIC, value))

val ActivityAnswer?.numericValue: Double? get() = (this as? NumericAnswerValue)?.value?.`value`

fun orderAnswer(ids: List<String>): ActivityAnswer =
    OrderAnswerValue(LessonStepAnswerOneOf3AnswerOneOf8(ids, LessonStepAnswerOneOf3AnswerOneOf8.Kind.ORDER))

val ActivityAnswer?.orderIds: List<String>? get() = (this as? OrderAnswerValue)?.value?.ids

fun selectionAnswer(ids: List<String>): ActivityAnswer =
    SelectionAnswerValue(LessonStepAnswerOneOf3AnswerOneOf13(ids, LessonStepAnswerOneOf3AnswerOneOf13.Kind.SELECTION))

val ActivityAnswer?.selectionIds: List<String>? get() = (this as? SelectionAnswerValue)?.value?.ids

fun assignmentAnswer(pairs: Map<String, String>): ActivityAnswer =
    AssignmentAnswerValue(LessonStepAnswerOneOf3AnswerOneOf(LessonStepAnswerOneOf3AnswerOneOf.Kind.ASSIGNMENT, pairs))

val ActivityExpected?.numericValue: Double? get() = (this as? ActivityExpected.NumericWrapper)?.value?.`value`

val ActivityExpected?.interaction: ActivityExpectedAnswer? get() = (this as? ActivityExpected.InteractionWrapper)?.value?.answer

val ActivityExpected?.orderIds: List<String>? get() = (interaction as? ActivityExpectedAnswer.OrderWrapper)?.value?.ids

val ActivityExpected?.selectionIds: List<String>? get() = (interaction as? ActivityExpectedAnswer.SelectionWrapper)?.value?.ids

val ActivityAnswer?.assignmentPairs: Map<String, String>? get() = (this as? AssignmentAnswerValue)?.value?.pairs

val ActivityExpected?.assignmentPairs: Map<String, String>? get() = (interaction as? ActivityExpectedAnswer.AssignmentWrapper)?.value?.pairs
