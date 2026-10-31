package com.zoonk.android.feature.mindmaps

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.ChapterMindMapStatus
import com.zoonk.api.models.GoalMindMaps
import com.zoonk.api.models.MindMapGeneration
import java.util.UUID

internal const val GOAL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01"

internal fun mapChapter(position: Int) = "c0000000-0000-4000-8000-%012d".format(position)

private const val PICTURE = "https://api.zoonk.test/v1/files/images/0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0a1"

internal const val OUTLINE =
    """{"branches":[{"explanation":"A wave carries energy from place to place.","points":["Amplitude is its height","Wavelength is its length"],"title":"What a wave is"},
     {"explanation":"How often it repeats sets the pitch.","points":["High frequency, high pitch"],"title":"Frequency and pitch"}],
     "centralIdea":"Waves move energy, not matter.","comparison":{"columns":[{"name":"Sound","points":["Needs a medium"]},{"name":"Light","points":["Travels in a vacuum"]}],"title":"Sound and light"},
     "summary":"A wave is energy on the move, described by its height, length and frequency.","title":"Waves and sound"}"""

internal fun mapJson(
    position: Int,
    title: String,
    status: String,
    image: Boolean = status == "ready",
    subject: String? = "natural-sciences",
    id: Int = position,
) = """
    {"chapterId":"${mapChapter(id)}","position":$position,"status":"$status","title":"$title",
     "image":${if (image) """{"height":2048,"width":2048,"url":"$PICTURE/map-$position.webp","thumbnailUrl":"$PICTURE/map-$position-thumb.webp"}""" else "null"},
     "outline":${if (status == "ready") OUTLINE else "null"},
     "subject":${subject?.let {
    """{"key":"$it","name":"${if (it == "natural-sciences") "Natural sciences" else "Mathematics"}"}"""
} ?: "null"}}
    """.trimIndent()

internal fun goalMindMaps(
    chapters: List<String> =
        listOf(
            mapJson(1, "Motion and forces", "ready"),
            mapJson(2, "Energy", "ready", image = false),
            mapJson(3, "Waves and sound", "available"),
            mapJson(4, "Electricity", "generating"),
            mapJson(1, "Functions", "failed", subject = "mathematics", id = 11),
        ),
    next: String? = null,
): GoalMindMaps =
    ApiJson.decodeFromString(
        """{"chapters":[${chapters.joinToString(",")}],"goal":{"id":"$GOAL","title":"Pass ENEM"},"nextChapter":${next ?: "null"}}""",
    )

internal fun chapterMindMap(
    status: String,
    image: Boolean = status == "ready",
): ChapterMindMap = ApiJson.decodeFromString(mapJson(3, "Waves and sound", status, image, subject = null))

internal class FakeMindMapApi : MindMapApi {
    var lists = 0
    var chapters = 0
    var created = mutableListOf<ChapterKey>()
    var create: () -> MindMapGeneration = { generation("generating") }

    /** Read in order; once empty, every read fails as a dropped connection. */
    var statuses = ArrayDeque<ChapterMindMapStatus.Status>()
    var asked = 0
    var picture: () -> ByteArray = { byteArrayOf(1, 2, 3) }
    var chapter: () -> ChapterMindMap = { chapterMindMap("available") }
    var mindMaps: () -> GoalMindMaps = { goalMindMaps() }

    override suspend fun list(
        session: AuthenticatedSession,
        goalId: UUID,
    ): GoalMindMaps {
        lists++
        return mindMaps()
    }

    override suspend fun chapter(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): ChapterMindMap {
        chapters++
        return chapter()
    }

    override suspend fun create(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): MindMapGeneration {
        created += key
        return create()
    }

    override suspend fun status(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): ChapterMindMapStatus.Status {
        asked++
        return statuses.removeFirstOrNull() ?: throw ApiException(ApiError.Network)
    }

    override suspend fun picture(
        session: AuthenticatedSession,
        url: String,
    ) = picture()
}

internal fun generation(status: String): MindMapGeneration = ApiJson.decodeFromString("""{"generationId":"run-1","status":"$status"}""")
