package com.zoonk.android.feature.questions

import com.zoonk.android.ui.components.LessonVisual
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * Any runner's question (a block's, a checkpoint's, a test's, a drilled mistake's, a mock's), read
 * from its API model with `recode()`. A format fills only the fields it uses, and a question never
 * carries its answer.
 */
@Serializable
data class Question(
    val itemId: String,
    val format: QuestionFormat,
    val question: String,
    val options: List<String>? = null,
    val select: Select? = null,
    val left: List<String>? = null,
    val right: List<String>? = null,
    val entry: NumericEntry? = null,
    val unit: NumericUnit? = null,
    val context: String? = null,
    val image: QuestionImage? = null,
    val visual: LessonVisual? = null,
    val set: ItemSet? = null,
    val citation: Citation? = null,
    /** A real past exam question, shown with its source before it's answered. */
    val quoted: Boolean = false,
    /** Fine-tunes where the plan starts and is never saved as a mistake. */
    val placement: Boolean = false,
    val drill: Drill? = null,
    val mistakeId: String? = null,
    val capsuleKey: String? = null,
    val timeMachine: TimeMachine? = null,
    val answered: AnsweredMark? = null,
    val area: String? = null,
)

@Serializable
enum class QuestionFormat {
    @SerialName("multipleChoice")
    MultipleChoice,

    @SerialName("trueFalse")
    TrueFalse,

    @SerialName("matchPairs")
    MatchPairs,

    @SerialName("numeric")
    Numeric,

    @SerialName("order")
    Order,

    @SerialName("typed")
    Typed,
}

/** How a goal's exam words a statement's verdict: right or wrong (Cebraspe) or true or false. */
@Serializable
enum class TrueFalseWords {
    @SerialName("rightWrong")
    RightWrong,

    @SerialName("trueFalse")
    TrueFalse,
}

/** How many options a multiple-choice question asks for; null on a question means one. */
@Serializable(with = SelectSerializer::class)
sealed interface Select {
    data class Count(
        val count: Int,
    ) : Select

    data object All : Select
}

val Select?.isMulti: Boolean get() = this != null && this != Select.Count(1)

/** Exactly as many picks as asked, or at least one for "all". */
fun Select.isComplete(picks: List<Int>): Boolean =
    when (this) {
        Select.All -> picks.isNotEmpty()
        is Select.Count -> picks.size == count
    }

@Serializable
data class NumericEntry(
    val kind: Kind,
    val places: Int? = null,
) {
    @Serializable
    enum class Kind {
        @SerialName("number")
        Number,

        @SerialName("integer")
        Integer,

        @SerialName("decimals")
        Decimals,

        @SerialName("fraction")
        Fraction,
    }
}

@Serializable
data class NumericUnit(
    val position: Position,
    val symbol: String,
) {
    @Serializable
    enum class Position {
        @SerialName("prefix")
        Prefix,

        @SerialName("suffix")
        Suffix,
    }
}

@Serializable
data class QuestionImage(
    val alt: String,
    val url: String,
    val width: Long? = null,
    val height: Long? = null,
)

/** The passage, case, chart or recording a set's questions share, asked back to back. */
@Serializable
data class ItemSet(
    val id: String,
    val kind: Kind,
    val count: Int,
    val position: Int,
    val title: String? = null,
    val text: String? = null,
    val source: String? = null,
    val visual: LessonVisual? = null,
    val listening: Listening? = null,
) {
    @Serializable
    enum class Kind {
        @SerialName("text")
        Text,

        @SerialName("chart")
        Chart,

        @SerialName("case")
        Case,

        @SerialName("audio")
        Audio,
    }

    @Serializable
    data class Listening(
        // The contract's `1 | 2` arrives as a JSON number the generated client writes as 1.0.
        @SerialName("plays") private val playsValue: Double,
        val audio: Audio? = null,
        val task: String? = null,
        val title: String? = null,
        /** Only once the set's questions are answered. */
        val transcript: List<TranscriptLine>? = null,
    ) {
        /** How many times the recording plays, as in the exam. */
        val plays: Int get() = playsValue.toInt()

        @Serializable
        data class Audio(
            val url: String,
            val durationMs: Long? = null,
        )
    }
}

@Serializable
data class TranscriptLine(
    val speaker: String,
    val text: String,
)

@Serializable
data class Citation(
    val text: String,
    val title: String? = null,
    val publisher: String? = null,
    val url: String? = null,
    val checkedAt: String? = null,
)

/** A saved mistake's question, played the way its cause calls for. */
@Serializable
data class Drill(
    val kind: Kind,
    val lesson: Lesson? = null,
    val timeLimitSeconds: Int? = null,
) {
    @Serializable
    enum class Kind {
        @SerialName("noGuessing")
        NoGuessing,

        @SerialName("readCarefully")
        ReadCarefully,

        @SerialName("reteach")
        Reteach,

        @SerialName("retry")
        Retry,

        @SerialName("spotTheTrap")
        SpotTheTrap,

        @SerialName("timed")
        Timed,
    }

    @Serializable
    data class Lesson(
        val id: String,
        val title: String,
        val ideas: List<String>,
    )

    /** A content gap brings its lesson's ideas back on a screen of their own before the questions. */
    val isIdeaFirst: Boolean get() = kind == Kind.Reteach && !lesson?.ideas.isNullOrEmpty()

    /** A misread is drilled by reading the whole question before its answers show. */
    val isReadFirst: Boolean get() = kind == Kind.ReadCarefully
}

/** The learner's last answer to this question before today; its words only when it was wrong. */
@Serializable
data class TimeMachine(
    val answeredAt: String,
    val isCorrect: Boolean,
    val answer: String? = null,
)

/** Answered on an earlier visit; a blank is neither right nor wrong. */
@Serializable
data class AnsweredMark(
    val isCorrect: Boolean,
    val blank: Boolean = false,
)

/** What a checked answer got, from a block, a checkpoint or a mistake's practice. */
@Serializable
data class AnswerFeedback(
    val isCorrect: Boolean,
    /** A statement left blank where a wrong answer cancels a right one: neither right nor a mistake. */
    val blank: Boolean = false,
    /** Null in checkpoints until they end. */
    val correctAnswer: Answer? = null,
    val explanation: String? = null,
    val workedSteps: List<String> = emptyList(),
    val trap: String? = null,
    val hyperdrive: Hyperdrive? = null,
    val mistakeFixed: Boolean = false,
    /** Every mistake a mistakes-practice answer fixed, this one's and others' on the same skill. */
    val fixedMistakeIds: List<String> = emptyList(),
    val savedToNotebook: Boolean = false,
    val transcript: List<TranscriptLine>? = null,
    /** A few misses in a row: the runner suggests a break. */
    val pauseSuggested: Boolean = false,
) {
    @Serializable
    data class Hyperdrive(
        val streak: Int,
    )

    val fixedCount: Int get() = maxOf(fixedMistakeIds.size, if (mistakeFixed) 1 else 0)
}

/** The answer a runner sends, in the API's shape (`{ "selectedIndex": 2 }`, `{ "dontKnow": true }`). */
@Serializable(with = AnswerSerializer::class)
sealed interface Answer {
    data class Choice(
        val index: Int,
    ) : Answer

    data class Choices(
        val indexes: List<Int>,
    ) : Answer

    data class TrueFalse(
        val isTrue: Boolean,
    ) : Answer

    data class Matches(
        val matches: List<Int>,
    ) : Answer

    data class Numeric(
        val value: Double,
    ) : Answer

    data class Order(
        val order: List<Int>,
    ) : Answer

    data class Text(
        val text: String,
    ) : Answer

    /** "I don't know yet", "I'm not sure", a blank statement, or a timed drill's time up. */
    data object DontKnow : Answer
}

/** The options an answer picks, in its order; none for other answers. */
val Answer?.picks: List<Int>
    get() =
        when (this) {
            is Answer.Choice -> listOf(index)
            is Answer.Choices -> indexes
            else -> emptyList()
        }

internal object SelectSerializer : KSerializer<Select> {
    override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

    override fun deserialize(decoder: Decoder): Select {
        val value = (decoder as JsonDecoder).decodeJsonElement().jsonPrimitive
        return value.intOrNull?.let(Select::Count) ?: Select.All
    }

    override fun serialize(
        encoder: Encoder,
        value: Select,
    ) {
        val element =
            when (value) {
                Select.All -> JsonPrimitive("all")
                is Select.Count -> JsonPrimitive(value.count)
            }
        (encoder as JsonEncoder).encodeJsonElement(element)
    }
}

internal object AnswerSerializer : KSerializer<Answer> {
    override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

    override fun deserialize(decoder: Decoder): Answer {
        val json = (decoder as JsonDecoder).decodeJsonElement().jsonObject

        fun indexes(key: String) = json.getValue(key).jsonArray.map { it.jsonPrimitive.int }

        return when {
            "selectedIndex" in json -> Answer.Choice(json.getValue("selectedIndex").jsonPrimitive.int)
            "selectedIndexes" in json -> Answer.Choices(indexes("selectedIndexes"))
            "isTrue" in json -> Answer.TrueFalse(json.getValue("isTrue").jsonPrimitive.boolean)
            "matches" in json -> Answer.Matches(indexes("matches"))
            "number" in json -> Answer.Numeric(json.getValue("number").jsonPrimitive.double)
            "order" in json -> Answer.Order(indexes("order"))
            "text" in json -> Answer.Text(json.getValue("text").jsonPrimitive.content)
            json["dontKnow"]?.jsonPrimitive?.booleanOrNull == true -> Answer.DontKnow
            else -> throw IllegalArgumentException("Unknown answer: $json")
        }
    }

    override fun serialize(
        encoder: Encoder,
        value: Answer,
    ) {
        val element: JsonObject =
            buildJsonObject {
                when (value) {
                    is Answer.Choice -> put("selectedIndex", value.index)
                    is Answer.Choices -> putJsonArray("selectedIndexes") { value.indexes.forEach { add(JsonPrimitive(it)) } }
                    is Answer.TrueFalse -> put("isTrue", value.isTrue)
                    is Answer.Matches -> putJsonArray("matches") { value.matches.forEach { add(JsonPrimitive(it)) } }
                    is Answer.Numeric -> put("number", value.value)
                    is Answer.Order -> putJsonArray("order") { value.order.forEach { add(JsonPrimitive(it)) } }
                    is Answer.Text -> put("text", value.text)
                    Answer.DontKnow -> put("dontKnow", true)
                }
            }
        (encoder as JsonEncoder).encodeJsonElement(element)
    }
}
