package com.zoonk.android.feature.mindmaps

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChapterLessonMaps
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.ChapterMindMapStatus
import com.zoonk.api.models.GoalMindMapGenerations
import com.zoonk.api.models.GoalMindMaps
import com.zoonk.api.models.MindMapGeneration
import com.zoonk.api.models.SavedMindMapState
import java.util.Locale
import java.util.UUID

internal const val GOAL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01"

internal fun mapChapter(position: Int) = "c0000000-0000-4000-8000-%012d".format(Locale.ROOT, position)

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
    lessonsToWrite: Int = 0,
    saved: Boolean = false,
) = """
    {"chapterId":"${mapChapter(
    id,
)}","position":$position,"status":"$status","title":"$title","lessonsToWrite":$lessonsToWrite,"saved":$saved,
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
            mapJson(4, "Electricity", "drawing"),
            mapJson(5, "Light", "writingLessons", lessonsToWrite = 3),
            mapJson(6, "Optics", "available", lessonsToWrite = 2),
            mapJson(7, "Modern physics", "plusRequired"),
            mapJson(8, "Nuclear physics", "plusRequired", lessonsToWrite = 2),
            mapJson(1, "Functions", "failed", subject = "mathematics", id = 11),
        ),
    lessonGroups: List<String> = emptyList(),
    saved: List<String> = emptyList(),
    offer: String = """{"eligible":0,"needLessons":0,"startable":0,"stop":null}""",
    firstTab: String = "chapters",
): GoalMindMaps =
    ApiJson.decodeFromString(
        """{"chapters":[${chapters.joinToString(",")}],"goal":{"id":"$GOAL","title":"Pass ENEM","displayName":"Pass ENEM"},
           "createOffer":$offer,"firstTab":"$firstTab","lessonGroups":[${lessonGroups.joinToString(
            ",",
        )}],"saved":[${saved.joinToString(",")}]}""",
    )

internal fun mapLesson(number: Int) = "1e550000-0000-4000-8000-%012d".format(Locale.ROOT, number)

internal fun lessonGroupJson(
    chapter: Int,
    count: Int,
    locked: Int = 0,
) = """{"chapterId":"${mapChapter(chapter)}","count":$count,"locked":$locked}"""

internal fun savedJson(
    kind: String,
    target: String,
    title: String,
    chapter: Int?,
    available: Boolean = true,
) = """{"available":$available,"chapterId":${chapter?.let {
    "\"${mapChapter(
        it,
    )}\""
} ?: "null"},"kind":"$kind","targetId":"$target","title":"$title"}"""

internal fun lessonMindMapJson(
    number: Int,
    title: String,
    locked: Boolean = false,
    saved: Boolean = false,
) = """
    {"lessonId":"${mapLesson(number)}","locked":$locked,"position":$number,"saved":$saved,"title":"$title",
     "map":${if (locked) {
    "null"
} else {
    """{"shape":"hub","ideas":[{"label":"Waves carry energy","text":"A wave moves energy from place to place, not matter."},
       {"label":"Pitch","text":"How often a wave repeats sets the pitch you hear."},{"label":"Loudness","text":"A taller wave sounds louder."}]}"""
}}}
    """.trimIndent()

internal fun chapterLessonMaps(
    chapter: Int = 3,
    lessons: List<String> = listOf(lessonMindMapJson(1, "What a wave is"), lessonMindMapJson(2, "Pitch and frequency")),
): ChapterLessonMaps =
    ApiJson.decodeFromString(
        """{"chapter":{"id":"${mapChapter(
            chapter,
        )}","position":$chapter,"title":"Waves and sound"},"lessons":[${lessons.joinToString(",")}]}""",
    )

internal fun chapterMindMap(
    status: String,
    image: Boolean = status == "ready",
    lessonsToWrite: Int = 0,
): ChapterMindMap = ApiJson.decodeFromString(mapJson(3, "Waves and sound", status, image, subject = null, lessonsToWrite = lessonsToWrite))

internal class FakeMindMapApi : MindMapApi {
    var lists = 0
    var chapters = 0
    var created = mutableListOf<ChapterKey>()
    var create: () -> MindMapGeneration = { generation("drawing") }

    /** Read in order; once empty, every read fails as a dropped connection. */
    var statuses = ArrayDeque<ChapterMindMapStatus.Status>()
    var asked = 0
    var picture: () -> ByteArray = { byteArrayOf(1, 2, 3) }
    var chapter: () -> ChapterMindMap = { chapterMindMap("available") }
    var mindMaps: () -> GoalMindMaps = { goalMindMaps() }
    var lessonMaps: () -> ChapterLessonMaps = { chapterLessonMaps() }
    val saved = mutableListOf<Pair<MindMapTarget, Boolean>>()
    var save: suspend (MindMapTarget, Boolean) -> SavedMindMapState = { target, saved -> savedState(target, saved) }
    var createdAll = 0
    var createAll: () -> GoalMindMapGenerations = { ApiJson.decodeFromString("""{"accepted":[],"joined":[],"unstarted":[],"stop":null}""") }

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

    override suspend fun lessonMaps(
        session: AuthenticatedSession,
        key: ChapterKey,
    ) = lessonMaps()

    override suspend fun save(
        session: AuthenticatedSession,
        goalId: UUID,
        target: MindMapTarget,
        saved: Boolean,
    ): SavedMindMapState {
        this.saved += target to saved
        return save(target, saved)
    }

    override suspend fun createAll(
        session: AuthenticatedSession,
        goalId: UUID,
    ): GoalMindMapGenerations {
        createdAll++
        return createAll()
    }
}

internal fun savedState(
    target: MindMapTarget,
    saved: Boolean,
): SavedMindMapState = SavedMindMapState(target.kind, saved, target.id)

internal fun generation(status: String): MindMapGeneration = ApiJson.decodeFromString("""{"generationId":"run-1","status":"$status"}""")
