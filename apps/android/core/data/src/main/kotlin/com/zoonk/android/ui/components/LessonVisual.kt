package com.zoonk.android.ui.components

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Main's `LessonVisual`, which questions, sets, mocks, lesson steps and a challenge's decisions share.
 * A kind this version doesn't know reads as [Unknown], which draws nothing, so a newer server never
 * fails the screen it's on.
 */
@Serializable(with = LessonVisualSerializer::class)
sealed interface LessonVisual {
    val title: String?

    @Serializable
    data class Chart(
        val chart: Kind,
        override val title: String,
        val categoryLabel: String,
        val valueLabel: String,
        val categories: List<String>,
        val series: List<Series>,
        val unit: String? = null,
        val axisStart: Double? = null,
        val source: String? = null,
    ) : LessonVisual {
        @Serializable
        enum class Kind {
            @SerialName("bar")
            Bar,

            @SerialName("line")
            Line,
        }

        @Serializable
        data class Series(
            val name: String,
            val values: List<Double>,
        )
    }

    @Serializable
    data class Timeline(
        override val title: String,
        val events: List<Event>,
    ) : LessonVisual {
        @Serializable
        data class Event(
            val date: String,
            val label: String,
            val detail: String? = null,
        )
    }

    /** Numbers on both axes: a scatter, a line or both per series, with dashed reference levels. */
    @Serializable
    data class Plot(
        override val title: String,
        val xLabel: String,
        val yLabel: String,
        val series: List<Series>,
        val xUnit: String? = null,
        val yUnit: String? = null,
        val references: List<Reference> = emptyList(),
        val source: String? = null,
    ) : LessonVisual {
        @Serializable
        enum class Mark {
            @SerialName("points")
            Points,

            @SerialName("line")
            Line,

            @SerialName("lineWithPoints")
            LineWithPoints,
        }

        @Serializable
        data class Series(
            val name: String,
            val mark: Mark,
            val points: List<Point>,
        )

        @Serializable
        data class Point(
            val x: Double,
            val y: Double,
            val label: String? = null,
        )

        @Serializable
        data class Reference(
            val label: String,
            val y: Double,
        )
    }

    @Serializable
    data object Unknown : LessonVisual {
        override val title: String? get() = null
    }
}

/** Reads a visual by its `kind` and writes it back with one, as the API sends it. */
internal object LessonVisualSerializer : KSerializer<LessonVisual> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("LessonVisual")

    override fun deserialize(decoder: Decoder): LessonVisual {
        val input = decoder as JsonDecoder
        val element = input.decodeJsonElement()
        val serializer = KINDS[element.jsonObject["kind"]?.jsonPrimitive?.contentOrNull] ?: return LessonVisual.Unknown
        return input.json.decodeFromJsonElement(serializer, element)
    }

    override fun serialize(
        encoder: Encoder,
        value: LessonVisual,
    ) {
        val output = encoder as JsonEncoder
        val (kind, element) =
            when (value) {
                is LessonVisual.Chart -> "chart" to output.json.encodeToJsonElement(LessonVisual.Chart.serializer(), value)
                is LessonVisual.Timeline -> "timeline" to output.json.encodeToJsonElement(LessonVisual.Timeline.serializer(), value)
                is LessonVisual.Plot -> "plot" to output.json.encodeToJsonElement(LessonVisual.Plot.serializer(), value)
                LessonVisual.Unknown -> null to JsonObject(emptyMap())
            }
        output.encodeJsonElement(kind?.let { JsonObject(mapOf("kind" to JsonPrimitive(it)) + element.jsonObject) } ?: element)
    }

    private val KINDS: Map<String?, KSerializer<out LessonVisual>> =
        mapOf(
            "chart" to LessonVisual.Chart.serializer(),
            "timeline" to LessonVisual.Timeline.serializer(),
            "plot" to LessonVisual.Plot.serializer(),
        )
}
