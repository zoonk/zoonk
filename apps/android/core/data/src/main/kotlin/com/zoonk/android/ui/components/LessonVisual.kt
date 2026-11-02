package com.zoonk.android.ui.components

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/** Main's `LessonVisual`, which questions, sets, mocks and lesson steps share. */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
sealed interface LessonVisual {
    @Serializable
    @SerialName("chart")
    data class Chart(
        val chart: Kind,
        val title: String,
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
    @SerialName("timeline")
    data class Timeline(
        val title: String,
        val events: List<Event>,
    ) : LessonVisual {
        @Serializable
        data class Event(
            val date: String,
            val label: String,
            val detail: String? = null,
        )
    }
}
