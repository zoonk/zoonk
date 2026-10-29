package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanChangeOperationsInner
import com.zoonk.api.models.PlanOperationOutput
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate

/**
 * A plan operation: what an edit asks for and what a saved change did, read from its JSON by
 * `kind` (the generated unions take one class per kind). A kind this app doesn't know reads as
 * [Unknown], which says only that the plan changed.
 */
sealed interface PlanOp {
    data class DailyMinutes(
        val minutes: Int,
    ) : PlanOp

    /** Sunday is 0. */
    data class WeekdayMinutes(
        val weekdays: List<Int>,
        val minutes: Int,
    ) : PlanOp

    data class LightWeek(
        val startDate: LocalDate,
    ) : PlanOp

    data class MoveWeeklyEvent(
        val from: LocalDate,
        val to: LocalDate,
    ) : PlanOp

    /** Null is no date: study everything at the learner's pace. */
    data class TargetDate(
        val date: LocalDate?,
    ) : PlanOp

    data class FocusAreas(
        val areas: List<String>,
        val parts: List<FocusPart> = emptyList(),
    ) : PlanOp

    data class ReduceAreas(
        val areas: List<String>,
    ) : PlanOp

    data class SkipAreas(
        val areas: List<String>,
    ) : PlanOp

    data class RestoreAreas(
        val areas: List<String>,
    ) : PlanOp

    data class AreaStart(
        val areas: List<String>,
        val pastBasics: Boolean,
    ) : PlanOp

    data class SkipActivities(
        val activities: List<String>,
    ) : PlanOp

    data class RestoreActivities(
        val activities: List<String>,
    ) : PlanOp

    /** `moreExplanation`, `balanced` or `morePractice`. */
    data class PracticeBias(
        val bias: String,
    ) : PlanOp

    /** `easier`, `standard` or `harder`. */
    data class DifficultyBias(
        val bias: String,
    ) : PlanOp

    /** `weekly`, `biweekly` or `finalWeeks`. */
    data class WrittenCadence(
        val cadence: String,
    ) : PlanOp

    data class FullCourse(
        val fullCourse: Boolean,
    ) : PlanOp

    data class BaseChoices(
        val choices: List<BaseChoice>,
    ) : PlanOp

    data object FitLessons : PlanOp

    data class AddSkills(
        val names: List<String>,
    ) : PlanOp

    data class Tools(
        val tools: List<ToolPick>,
    ) : PlanOp

    data object FollowNotice : PlanOp

    data class NoticeDate(
        val date: LocalDate,
        val estimated: Boolean,
    ) : PlanOp

    data object FitPhaseDates : PlanOp

    data class ExamChoice(
        val group: String,
        val subject: String,
    ) : PlanOp

    data object Unknown : PlanOp

    companion object
}

data class FocusPart(
    val area: String,
    val name: String,
    val skillIds: List<String>,
)

/** [choice] is `deep`, `essential`, `quick` or `skip`. */
data class BaseChoice(
    val skillId: String,
    val choice: String,
)

/** [choice] is `have`, `setup` or `none`; [system] the device a setup is for. */
data class ToolPick(
    val name: String,
    val choice: String,
    val system: String?,
)

val PlanChangeOperationsInner.op: PlanOp
    get() = PlanOp.of(ApiJson.encodeToJsonElement(PlanChangeOperationsInner.serializer(), this).jsonObject)

val PlanOperationOutput.op: PlanOp
    get() = PlanOp.of(ApiJson.encodeToJsonElement(PlanOperationOutput.serializer(), this).jsonObject)

fun PlanOp.Companion.of(json: JsonObject): PlanOp =
    when (json.string("kind")) {
        "setDailyMinutes" -> {
            PlanOp.DailyMinutes(json.int("minutes"))
        }

        "setWeekdayMinutes" -> {
            PlanOp.WeekdayMinutes(json.ints("weekdays"), json.int("minutes"))
        }

        "addLightWeek" -> {
            PlanOp.LightWeek(json.date("startDate"))
        }

        "moveWeeklyEvent" -> {
            PlanOp.MoveWeeklyEvent(json.date("from"), json.date("to"))
        }

        "setTargetDate" -> {
            PlanOp.TargetDate(json.string("targetDate")?.let(LocalDate::parse))
        }

        "focusAreas" -> {
            PlanOp.FocusAreas(json.strings("areas"), json.objects("parts").map(::focusPart))
        }

        "reduceAreas" -> {
            PlanOp.ReduceAreas(json.strings("areas"))
        }

        "skipAreas" -> {
            PlanOp.SkipAreas(json.strings("areas"))
        }

        "restoreAreas" -> {
            PlanOp.RestoreAreas(json.strings("areas"))
        }

        "setAreaStart" -> {
            PlanOp.AreaStart(json.strings("areas"), json.string("start") == "pastBasics")
        }

        "skipActivities" -> {
            PlanOp.SkipActivities(json.strings("activities"))
        }

        "restoreActivities" -> {
            PlanOp.RestoreActivities(json.strings("activities"))
        }

        "setPracticeBias" -> {
            PlanOp.PracticeBias(json.string("bias").orEmpty())
        }

        "setDifficultyBias" -> {
            PlanOp.DifficultyBias(json.string("bias").orEmpty())
        }

        "setWrittenCadence" -> {
            PlanOp.WrittenCadence(json.string("cadence").orEmpty())
        }

        "setFullCourse" -> {
            PlanOp.FullCourse(json.boolean("fullCourse"))
        }

        "setBaseChoices" -> {
            PlanOp.BaseChoices(
                json.objects("choices").map {
                    BaseChoice(it.string("skillId").orEmpty(), it.string("choice").orEmpty())
                },
            )
        }

        "fitLessons" -> {
            PlanOp.FitLessons
        }

        "addSkills" -> {
            PlanOp.AddSkills(json.objects("skills").mapNotNull { it.string("name") })
        }

        "setTools" -> {
            PlanOp.Tools(json.objects("tools").map(::toolPick))
        }

        "followNotice" -> {
            PlanOp.FollowNotice
        }

        "setNoticeDate" -> {
            PlanOp.NoticeDate(json.date("targetDate"), json.boolean("estimated"))
        }

        "fitPhaseDates" -> {
            PlanOp.FitPhaseDates
        }

        "setExamChoice" -> {
            PlanOp.ExamChoice(json.string("group").orEmpty(), json.string("subject").orEmpty())
        }

        else -> {
            PlanOp.Unknown
        }
    }

/**
 * The operation as the API takes it in a change or a preview, or null for one only the server
 * makes. "No date" sends `targetDate: null` explicitly, which the generated models would drop.
 */
fun PlanOp.toJson(): JsonObject? =
    when (this) {
        is PlanOp.DailyMinutes -> {
            op("setDailyMinutes") { put("minutes", minutes) }
        }

        is PlanOp.WeekdayMinutes -> {
            op("setWeekdayMinutes") {
                put("weekdays", JsonArray(weekdays.map(::JsonPrimitive)))
                put("minutes", minutes)
            }
        }

        is PlanOp.LightWeek -> {
            op("addLightWeek") { put("startDate", startDate.toString()) }
        }

        is PlanOp.MoveWeeklyEvent -> {
            op("moveWeeklyEvent") {
                put("from", from.toString())
                put("to", to.toString())
            }
        }

        is PlanOp.TargetDate -> {
            op("setTargetDate") { put("targetDate", date?.toString()?.let(::JsonPrimitive) ?: JsonNull) }
        }

        is PlanOp.FocusAreas -> {
            op("focusAreas") {
                put("areas", areas.json())
                if (parts.isNotEmpty()) {
                    put(
                        "parts",
                        buildJsonArray {
                            parts.forEach { part ->
                                add(
                                    buildJsonObject {
                                        put("area", part.area)
                                        put("name", part.name)
                                        put("skillIds", part.skillIds.json())
                                    },
                                )
                            }
                        },
                    )
                }
            }
        }

        is PlanOp.ReduceAreas -> {
            op("reduceAreas") { put("areas", areas.json()) }
        }

        is PlanOp.SkipAreas -> {
            op("skipAreas") { put("areas", areas.json()) }
        }

        is PlanOp.RestoreAreas -> {
            op("restoreAreas") { put("areas", areas.json()) }
        }

        is PlanOp.AreaStart -> {
            op("setAreaStart") {
                put("areas", areas.json())
                put("start", if (pastBasics) "pastBasics" else "basics")
            }
        }

        is PlanOp.SkipActivities -> {
            op("skipActivities") { put("activities", activities.json()) }
        }

        is PlanOp.RestoreActivities -> {
            op("restoreActivities") { put("activities", activities.json()) }
        }

        is PlanOp.PracticeBias -> {
            op("setPracticeBias") { put("bias", bias) }
        }

        is PlanOp.DifficultyBias -> {
            op("setDifficultyBias") { put("bias", bias) }
        }

        is PlanOp.WrittenCadence -> {
            op("setWrittenCadence") { put("cadence", cadence) }
        }

        is PlanOp.FullCourse -> {
            op("setFullCourse") { put("fullCourse", fullCourse) }
        }

        is PlanOp.BaseChoices -> {
            op("setBaseChoices") {
                put(
                    "choices",
                    buildJsonArray {
                        choices.forEach { choice ->
                            add(
                                buildJsonObject {
                                    put("skillId", choice.skillId)
                                    put("choice", choice.choice)
                                },
                            )
                        }
                    },
                )
            }
        }

        PlanOp.FitLessons -> {
            op("fitLessons") {}
        }

        is PlanOp.AddSkills, is PlanOp.Tools, PlanOp.FollowNotice, is PlanOp.NoticeDate, PlanOp.FitPhaseDates, is PlanOp.ExamChoice,
        PlanOp.Unknown,
        -> {
            null
        }
    }

private fun op(
    kind: String,
    fields: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit,
) = buildJsonObject {
    put("kind", kind)
    fields()
}

private fun List<String>.json() = JsonArray(map(::JsonPrimitive))

private fun focusPart(json: JsonObject) = FocusPart(json.string("area").orEmpty(), json.string("name").orEmpty(), json.strings("skillIds"))

private fun toolPick(json: JsonObject) = ToolPick(json.string("name").orEmpty(), json.string("choice").orEmpty(), json.string("system"))

private fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

private fun JsonObject.boolean(key: String): Boolean = (this[key] as? JsonPrimitive)?.booleanOrNull == true

private fun JsonObject.int(key: String): Int = (this[key] as? JsonPrimitive)?.intOrNull ?: 0

private fun JsonObject.date(key: String): LocalDate = LocalDate.parse(string(key))

private fun JsonObject.strings(key: String): List<String> =
    (this[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty()

private fun JsonObject.ints(key: String): List<Int> = (this[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.intOrNull }.orEmpty()

private fun JsonObject.objects(key: String): List<JsonObject> = (this[key] as? JsonArray)?.mapNotNull { it as? JsonObject }.orEmpty()
