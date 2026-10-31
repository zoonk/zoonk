package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanChangeOperationsInner
import com.zoonk.api.models.PlanFocusPart
import com.zoonk.api.models.PlanOperation
import com.zoonk.api.models.PlanOperationOneOf
import com.zoonk.api.models.PlanOperationOneOf1
import com.zoonk.api.models.PlanOperationOneOf10
import com.zoonk.api.models.PlanOperationOneOf11
import com.zoonk.api.models.PlanOperationOneOf12
import com.zoonk.api.models.PlanOperationOneOf13
import com.zoonk.api.models.PlanOperationOneOf14
import com.zoonk.api.models.PlanOperationOneOf15
import com.zoonk.api.models.PlanOperationOneOf15ChoicesInner
import com.zoonk.api.models.PlanOperationOneOf16
import com.zoonk.api.models.PlanOperationOneOf17
import com.zoonk.api.models.PlanOperationOneOf2
import com.zoonk.api.models.PlanOperationOneOf3
import com.zoonk.api.models.PlanOperationOneOf4
import com.zoonk.api.models.PlanOperationOneOf5
import com.zoonk.api.models.PlanOperationOneOf6
import com.zoonk.api.models.PlanOperationOneOf7
import com.zoonk.api.models.PlanOperationOneOf8
import com.zoonk.api.models.PlanOperationOneOf9
import com.zoonk.api.models.PlanOperationOutput
import kotlinx.datetime.toKotlinLocalDate
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
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

/** The operation as the API takes it in a change or a preview, or null for one only the server makes. */
fun PlanOp.toOperation(): PlanOperation? =
    when (this) {
        is PlanOp.DailyMinutes -> {
            PlanOperation.PlanOperationOneOfValue(PlanOperationOneOf(PlanOperationOneOf.Kind.SET_DAILY_MINUTES, minutes.toLong()))
        }

        is PlanOp.WeekdayMinutes -> {
            PlanOperation.PlanOperationOneOf1Value(
                PlanOperationOneOf1(PlanOperationOneOf1.Kind.SET_WEEKDAY_MINUTES, minutes.toLong(), weekdays.map(Int::toLong)),
            )
        }

        is PlanOp.LightWeek -> {
            PlanOperation.PlanOperationOneOf2Value(
                PlanOperationOneOf2(PlanOperationOneOf2.Kind.ADD_LIGHT_WEEK, startDate.toKotlinLocalDate()),
            )
        }

        is PlanOp.MoveWeeklyEvent -> {
            PlanOperation.PlanOperationOneOf3Value(
                PlanOperationOneOf3(
                    from = from.toKotlinLocalDate(),
                    kind = PlanOperationOneOf3.Kind.MOVE_WEEKLY_EVENT,
                    to = to.toKotlinLocalDate(),
                ),
            )
        }

        is PlanOp.TargetDate -> {
            PlanOperation.PlanOperationOneOf4Value(PlanOperationOneOf4(PlanOperationOneOf4.Kind.SET_TARGET_DATE, date?.toKotlinLocalDate()))
        }

        is PlanOp.FocusAreas -> {
            PlanOperation.PlanOperationOneOf5Value(
                PlanOperationOneOf5(
                    areas,
                    PlanOperationOneOf5.Kind.FOCUS_AREAS,
                    parts.map { PlanFocusPart(area = it.area, name = it.name, skillIds = it.skillIds) }.ifEmpty { null },
                ),
            )
        }

        is PlanOp.SkipAreas -> {
            PlanOperation.PlanOperationOneOf6Value(PlanOperationOneOf6(areas, PlanOperationOneOf6.Kind.SKIP_AREAS))
        }

        is PlanOp.RestoreAreas -> {
            PlanOperation.PlanOperationOneOf7Value(PlanOperationOneOf7(areas, PlanOperationOneOf7.Kind.RESTORE_AREAS))
        }

        is PlanOp.ReduceAreas -> {
            PlanOperation.PlanOperationOneOf8Value(PlanOperationOneOf8(areas, PlanOperationOneOf8.Kind.REDUCE_AREAS))
        }

        is PlanOp.SkipActivities -> {
            PlanOperation.PlanOperationOneOf9Value(
                PlanOperationOneOf9(activities.map { contractEnum(it) }, PlanOperationOneOf9.Kind.SKIP_ACTIVITIES),
            )
        }

        is PlanOp.RestoreActivities -> {
            PlanOperation.PlanOperationOneOf10Value(
                PlanOperationOneOf10(
                    activities.map {
                        contractEnum(it)
                    },
                    PlanOperationOneOf10.Kind.RESTORE_ACTIVITIES,
                ),
            )
        }

        is PlanOp.PracticeBias -> {
            PlanOperation.PlanOperationOneOf11Value(PlanOperationOneOf11(contractEnum(bias), PlanOperationOneOf11.Kind.SET_PRACTICE_BIAS))
        }

        is PlanOp.DifficultyBias -> {
            PlanOperation.PlanOperationOneOf12Value(PlanOperationOneOf12(contractEnum(bias), PlanOperationOneOf12.Kind.SET_DIFFICULTY_BIAS))
        }

        is PlanOp.WrittenCadence -> {
            PlanOperation.PlanOperationOneOf13Value(
                PlanOperationOneOf13(contractEnum(cadence), PlanOperationOneOf13.Kind.SET_WRITTEN_CADENCE),
            )
        }

        is PlanOp.FullCourse -> {
            PlanOperation.PlanOperationOneOf14Value(PlanOperationOneOf14(fullCourse, PlanOperationOneOf14.Kind.SET_FULL_COURSE))
        }

        is PlanOp.BaseChoices -> {
            PlanOperation.PlanOperationOneOf15Value(
                PlanOperationOneOf15(
                    choices.map { PlanOperationOneOf15ChoicesInner(contractEnum(it.choice), it.skillId) },
                    PlanOperationOneOf15.Kind.SET_BASE_CHOICES,
                ),
            )
        }

        PlanOp.FitLessons -> {
            PlanOperation.PlanOperationOneOf16Value(PlanOperationOneOf16(PlanOperationOneOf16.Kind.FIT_LESSONS))
        }

        is PlanOp.AreaStart -> {
            PlanOperation.PlanOperationOneOf17Value(
                PlanOperationOneOf17(
                    areas,
                    PlanOperationOneOf17.Kind.SET_AREA_START,
                    if (pastBasics) PlanOperationOneOf17.Start.PAST_BASICS else PlanOperationOneOf17.Start.BASICS,
                ),
            )
        }

        is PlanOp.AddSkills, is PlanOp.Tools, PlanOp.FollowNotice, is PlanOp.NoticeDate, PlanOp.FitPhaseDates, is PlanOp.ExamChoice,
        PlanOp.Unknown,
        -> {
            null
        }
    }

private inline fun <reified T> contractEnum(value: String): T = ApiJson.decodeFromJsonElement(JsonPrimitive(value))

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
