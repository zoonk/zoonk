package com.zoonk.android.feature.activities

import com.zoonk.android.feature.activities.code.patternAnswer
import com.zoonk.android.feature.activities.geometry.Molecule
import com.zoonk.android.feature.activities.geometry.moleculeAnswer
import com.zoonk.android.feature.activities.geometry.moleculeElements
import com.zoonk.android.feature.activities.music.KeyboardFretboard
import com.zoonk.android.feature.activities.music.notesAnswer
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.feature.player.model.toLessonStep
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.ActivityExpectedAnswer
import com.zoonk.api.models.PlayableLibraryStep
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.UUID
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf11Value as LabeledDiagramContent

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

    /** The learner's answer that reaches the expected end state: where both are written alike, a pattern template's solution, a pitch-class answer's notes, or a complete molecule with the expected atoms. */
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

                    is ActivityExpectedAnswer.MoleculeWrapper -> {
                        expected.moleculeElements?.let(Molecule::findStructure)?.let(::moleculeAnswer)
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

    /** The fixture's step, sent as the API sends it and read by the player's own loader, with [check] in place of its own when given. */
    fun step(
        name: String,
        id: String = name,
        check: JsonObject? = null,
    ): LessonStep {
        val written = entry(name).getValue("content").jsonObject
        return sentStep(id, "activity", if (check == null) written else JsonObject(written + ("check" to check))) {
            put("picture", entry(name)["picture"] ?: JsonNull)
            put("baseMap", entry(name)["baseMap"] ?: JsonNull)
        }
    }

    /** A step of content a fixture doesn't have, sent as the API sends it. */
    fun step(
        json: JsonElement,
        id: String,
    ): LessonStep = sentStep(id, "activity", json) {}

    /** The fixtures whose template an explanation can explore. */
    val exploreNames: Set<String> get() =
        all
            .filterValues {
                it.jsonObject["explore"].let { explore ->
                    explore != null &&
                        explore !is JsonNull
                }
            }.keys

    /** An explanation exploring the fixture's activity, as main's preview `exploreStep`, sent as the API sends it and read by the player's own loader. */
    fun exploreStep(
        name: String,
        id: String = name,
    ): LessonStep {
        val explore = entry(name).getValue("explore").jsonObject
        val content =
            buildJsonObject {
                put("text", "Explore $name.")
                put("title", name)
                put("explore", explore.getValue("content"))
            }
        return sentStep(id, "explanation", content) {
            put("exploreExpected", explore.getValue("expected"))
            put("picture", explore.getValue("picture"))
            put("baseMap", entry(name)["baseMap"] ?: JsonNull)
        }
    }

    /** A step as the API sends it, read by the player's loader; it keeps [id] so tests can name it, and a labeled diagram's picture is drawn, as in main's `activityStep`. */
    private fun sentStep(
        id: String,
        kind: String,
        content: JsonElement,
        fields: JsonObjectBuilder.() -> Unit,
    ): LessonStep {
        val sent =
            buildJsonObject {
                put("id", UUID.nameUUIDFromBytes(id.toByteArray()).toString())
                put("kind", kind)
                put("position", 0)
                put("skillId", JsonNull)
                put("citation", JsonNull)
                put("image", JsonNull)
                put("imagePending", false)
                put("picture", JsonNull)
                put("baseMap", JsonNull)
                put("minTolerance", JsonNull)
                put("content", content)
                fields()
            }
        val step = ApiJson.decodeFromJsonElement(PlayableLibraryStep.serializer(), sent).toLessonStep()
        val drawn =
            when (val read = step.content) {
                is StepContent.Activity -> read.content
                is StepContent.Explanation -> read.explore?.content
                else -> null
            }
        return step.copy(id = id, image = drawn?.let { drawnPicture(it, id) })
    }

    private fun drawnPicture(
        content: ActivityStepContent,
        id: String,
    ) = (content as? LabeledDiagramContent)?.let {
        StepImage("$id-picture", "https://api.zoonk.test/v1/files/$id-picture", it.value.fields.picture.alt, 1024, 1280)
    }
}
