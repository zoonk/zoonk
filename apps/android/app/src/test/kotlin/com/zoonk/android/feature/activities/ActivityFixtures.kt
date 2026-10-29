package com.zoonk.android.feature.activities

import com.zoonk.android.feature.activities.code.patternAnswer
import com.zoonk.android.feature.activities.music.KeyboardFretboard
import com.zoonk.android.feature.activities.music.notesAnswer
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.ActivityExpectedAnswer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Main's activity fixtures with core's expected end state and value, from `pnpm --filter android fixtures:activities`. */
object ActivityFixtures {
    private val all: JsonObject by lazy {
        ApiJson.parseToJsonElement(checkNotNull(javaClass.getResource("/activity-fixtures.json")).readText()).jsonObject
    }

    val names: Set<String> get() = all.keys

    private fun entry(name: String) = checkNotNull(all[name]) { "No fixture $name" }.jsonObject

    fun content(name: String): ActivityStepContent =
        ApiJson.decodeFromJsonElement(ActivityStepContent.serializer(), entry(name).getValue("content"))

    fun expected(name: String): ActivityExpected? =
        entry(name)["expected"]?.takeUnless { it is JsonNull }?.let { ApiJson.decodeFromJsonElement(ActivityExpected.serializer(), it) }

    /** A fixture's content as the API sends it, to vary for a test. */
    fun contentJson(name: String): JsonObject = entry(name).getValue("content").jsonObject

    private fun fields(name: String) = contentJson(name).getValue("fields").jsonObject

    fun value(name: String): Double? = entry(name)["value"]?.jsonPrimitive?.doubleOrNull

    /** The learner's answer that reaches the expected end state: where both are written alike, a pattern template's solution, or a pitch-class answer's notes. */
    fun rightAnswer(name: String): ActivityAnswer? =
        when (val expected = expected(name)) {
            is ActivityExpected.ChoiceWrapper -> {
                choiceAnswer(expected.value.optionId)
            }

            is ActivityExpected.NumericWrapper -> {
                numericAnswer(expected.value.`value`)
            }

            is ActivityExpected.InteractionWrapper -> {
                when (val answer = expected.value.answer) {
                    is ActivityExpectedAnswer.RegexWrapper, is ActivityExpectedAnswer.FormulaWrapper -> {
                        patternAnswer(fields(name).getValue("solution").jsonPrimitive.content)
                    }

                    is ActivityExpectedAnswer.PitchclassesWrapper -> {
                        notesAnswer(KeyboardFretboard.notes(answer.value.pitchClasses.map { it.toInt() }))
                    }

                    else -> {
                        runCatching {
                            ApiJson.decodeFromJsonElement(
                                ActivityAnswer.serializer(),
                                ApiJson.encodeToJsonElement(ActivityExpectedAnswer.serializer(), answer),
                            )
                        }.getOrNull()
                    }
                }
            }

            null -> {
                null
            }
        }

    /** The fixture's step, with [check] in place of its own when given. */
    fun step(
        name: String,
        id: String = name,
        check: JsonObject? = null,
    ): LessonStep {
        val written = entry(name).getValue("content").jsonObject
        return step(if (check == null) written else JsonObject(written + ("check" to check)), id)
    }

    /** A step of content a fixture doesn't have, written as the API sends it. */
    fun step(
        json: JsonElement,
        id: String,
    ): LessonStep {
        val content = ApiJson.decodeFromJsonElement(ActivityStepContent.serializer(), json)
        val frame = ApiJson.decodeFromJsonElement(ActivityFrame.serializer(), json)
        return LessonStep(id, null, StepContent.Activity(content, frame, minTolerance = null))
    }
}
