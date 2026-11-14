package com.zoonk.android.feature.mindmaps

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

/**
 * Review screenshots of the Mind maps page's tabs and offers, a map's row in every state where it shows, the study reader and the viewer, written only
 * on demand: `./gradlew :feature:plan:testDebugUnitTest --tests '*MindMapScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * Pictures don't load on the JVM, so they show as their muted surface.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MindMapScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1800dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h3600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "de-w320dp-h1400dp-xxhdpi")
    fun smallPhoneGerman() = capture("small-de")

    @Test
    @Config(qualifiers = "w700dp-h1400dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() = capture("expanded")

    @Test
    @Config(qualifiers = BOOK)
    fun book() = capture("book", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookDarkMoreContrast() = capture("book-dark-more-contrast", dark = true, moreContrast = true, fold = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("book-font200", fold = true)
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookRightToLeft() = capture("book-rtl", fold = true, layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun galaxyFold() = capture("galaxy-fold", fold = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookBesideTheRail() = capture("book-rail", fold = true, rail = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun galaxyFoldBesideTheRail() = capture("galaxy-fold-rail", fold = true, rail = true)

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        fold: Boolean = false,
        layoutDirection: LayoutDirection? = null,
        rail: Boolean = false,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                val context = LocalContext.current
                val pictures = remember { PrivatePictures(AppContainer.preview(context).images, SESSION) }
                CompositionLocalProvider(
                    LocalPrivatePictures provides pictures,
                    LocalLayoutDirection provides (layoutDirection ?: LocalLayoutDirection.current),
                ) {
                    // The shell lays a pushed page beside Material's 80dp navigation rail.
                    Surface(Modifier.padding(start = if (rail) 80.dp else 0.dp)) { key(index) { SCREENS[index].second() } }
                }
            }
        }
        if (fold) compose.unfoldBook(folds)
        SCREENS.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            write("${SCREENS[screen].first}-$name", compose.onRoot().captureRender().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }

    private companion object {
        const val BOOK = "w852dp-h883dp-xhdpi"
        val SESSION = AuthenticatedSession("ana", "token-a", "local-a")
        val FREE_CAP = Limit.Reached(LimitTier.Free, LimitPeriod.Day)
        val NO_ACTIONS = MindMapsActions({}, {}, {}, {})
        val ROW_ACTIONS = MindMapRowActions({}, {}, {})
        val STUDY_ACTIONS = StudyActions({}, { _, _, _ -> }, {}, {})
        val ALL = offer(needLessons = 0, startable = 5)
        val PART = offer(needLessons = 2, startable = 3, stop = stop("limitReached", "\"mindMap\"", "\"day\""))
        val PLUS_MONTH = offer(needLessons = 0, startable = 0, stop = stop("limitReached", "\"mindMap\"", "\"month\""))
        val GUEST = offer(needLessons = 1, startable = 0, stop = stop("signUpRequired", "null", "null"))
        val FREE_LIMIT = offer(needLessons = 2, startable = 0, stop = stop("limitReached", "\"mindMap\"", "\"day\""))
        val NEED_LESSONS = offer(needLessons = 2, startable = 0, eligible = 0)
        val NEED_LESSONS_AT_LIMIT =
            offer(needLessons = 2, startable = 0, eligible = 0, stop = stop("limitReached", "\"mindMap\"", "\"day\""))

        fun offer(
            needLessons: Int,
            startable: Int,
            eligible: Int = 5,
            stop: String = "null",
        ) = """{"eligible":$eligible,"needLessons":$needLessons,"startable":$startable,"stop":$stop}"""

        fun stop(
            reason: String,
            resource: String,
            period: String,
        ) = """{"reason":"$reason","resource":$resource,"period":$period,"resetsAt":null}"""

        val CHAPTERS =
            listOf(
                mapJson(1, "Motion and forces", "ready", saved = true),
                mapJson(2, "Energy", "ready", image = false),
                mapJson(3, "Waves and sound", "available"),
                mapJson(4, "Electricity", "drawing"),
                mapJson(5, "Light", "writingLessons", lessonsToWrite = 3),
                mapJson(6, "Optics", "available", lessonsToWrite = 2),
                mapJson(1, "Functions", "failed", subject = "mathematics", id = 11),
            )

        /** The chapters with none on their way. */
        val SETTLED = CHAPTERS.filterNot { "\"drawing\"" in it || "\"writingLessons\"" in it }
        val GROUPS =
            listOf(
                lessonGroupJson(1, (1..4).toList()),
                lessonGroupJson(2, (5..7).toList()),
                lessonGroupJson(11, (8..11).toList()),
            )
        val SAVED =
            listOf(
                savedJson("chapter", mapChapter(1), "Motion and forces", chapter = 1),
                savedJson("lesson", mapLesson(2), "Pitch and frequency", chapter = 3),
                savedJson("chapter", mapChapter(30), "Thermodynamics", chapter = null, available = false),
            )

        @Composable
        fun Library(
            offer: String = ALL,
            tab: StudyTab = StudyTab.Chapters,
            tier: LimitTier = LimitTier.Free,
            notMade: Boolean = false,
            createAll: CreateAll? = null,
            chapters: List<String> = CHAPTERS,
            groups: List<String> = GROUPS,
            saved: List<String> = SAVED,
        ) {
            val stuck = mapOf(UUID.fromString(mapChapter(11)) to MindMapLocal(unreachable = true))
            MindMapsPage(
                goalMindMaps(chapters, groups, saved, offer),
                MindMapsState(requests = stuck, createAll = createAll, plus = tier == LimitTier.Plus, tier = tier),
                NO_ACTIONS,
                initialTab = tab,
                notMadeShown = notMade,
            )
        }

        /** 30 ready maps over three subjects: past twelve, each folds to its title. */
        val LONG =
            (1..30).map {
                mapJson(
                    it,
                    "Chapter title $it",
                    "ready",
                    subject = listOf("natural-sciences", "mathematics", "history")[it % 3],
                    id = it,
                )
            }

        @Composable
        fun Study(
            slide: Slide,
            start: Int = 4,
            count: Int = 12,
        ) {
            MindMapStudy(
                List(count) { DeckSlot.Chapter(mapChapter(it)) },
                start = start,
                slide = { slide },
                saves = emptyMap(),
                actions = STUDY_ACTIONS,
            )
        }

        val chapterSlide = { saved: Boolean ->
            val map = chapterMindMap("ready")
            Slide.Chapter(map.chapterId, ViewedMap(map.title, map.image, map.outline!!), saved)
        }

        @Composable
        fun Row(
            status: String,
            place: MindMapPlace,
            shown: MindMapShown = chapterMindMap(status).facts.status,
            image: Boolean = status == "ready",
            lessonsToWrite: Int = 0,
            local: MindMapLocal? = null,
            cap: Limit? = null,
            plus: Boolean = false,
        ) {
            val map = chapterMindMap(status, image, lessonsToWrite).facts
            // Where a chapter ends, the row sits in the result's column, its words lined up with the column's.
            val finish = place == MindMapPlace.Finish
            MindMapRow(map, place, shown, local, cap, plus, ROW_ACTIONS, if (finish) Modifier.bleed(LIST_ITEM_INSET) else Modifier)
        }

        @Composable
        fun Rows(place: MindMapPlace) {
            val inset = if (place == MindMapPlace.Finish) LIST_ITEM_INSET else 0.dp
            Column(Modifier.padding(horizontal = inset, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (place == MindMapPlace.Finish) SectionLabel(stringResource(R.string.mindmaps_chapter_finished))
                Row("available", place)
                Row("available", place, lessonsToWrite = 4)
                Row("available", place, lessonsToWrite = 4, plus = true)
                Row("writingLessons", place, lessonsToWrite = 4)
                Row("drawing", place)
                Row("ready", place)
                Row("ready", place, image = false)
                Row("failed", place)
                Row("failed", place, shown = MindMapShown.Unreachable)
                Row("available", place, cap = FREE_CAP)
                Row(
                    "available",
                    place,
                    shown = MindMapShown.Refused,
                    lessonsToWrite = 4,
                    local =
                        MindMapLocal(
                            limit = Limit.Reached(LimitTier.Free, LimitPeriod.Month),
                            subject = LimitSubject.Lessons,
                        ),
                )
            }
        }

        val SCREENS: List<Pair<String, @Composable () -> Unit>> =
            listOf(
                "mind-maps" to { Library() },
                "mind-maps-not-made-open" to { Library(notMade = true) },
                "mind-maps-offer-part" to { Library(PART) },
                "mind-maps-offer-plus-month" to { Library(PLUS_MONTH, tier = LimitTier.Plus) },
                "mind-maps-offer-guest" to { Library(GUEST, tier = LimitTier.Guest) },
                "mind-maps-offer-all-settled" to { Library(ALL, chapters = SETTLED) },
                "mind-maps-offer-part-settled" to { Library(PART, chapters = SETTLED) },
                "mind-maps-offer-free-limit" to { Library(FREE_LIMIT, chapters = SETTLED) },
                "mind-maps-offer-free-limit-open" to { Library(FREE_LIMIT, chapters = SETTLED, notMade = true) },
                "mind-maps-offer-need-lessons-at-limit-open" to { Library(NEED_LESSONS_AT_LIMIT, chapters = SETTLED, notMade = true) },
                "mind-maps-offer-need-lessons" to { Library(NEED_LESSONS, chapters = SETTLED, notMade = true) },
                "mind-maps-offer-need-lessons-plus" to { Library(NEED_LESSONS, chapters = SETTLED, notMade = true, tier = LimitTier.Plus) },
                "mind-maps-offer-unreachable" to { Library(ALL, chapters = SETTLED, createAll = CreateAll.Unreachable) },
                "mind-maps-long" to { Library(chapters = LONG) },
                "mind-maps-lessons" to { Library(tab = StudyTab.Lessons) },
                "mind-maps-lessons-empty" to { Library(tab = StudyTab.Lessons, groups = emptyList()) },
                "mind-maps-saved" to { Library(tab = StudyTab.Saved) },
                "mind-maps-saved-empty" to { Library(tab = StudyTab.Saved, saved = emptyList()) },
                "mind-maps-empty" to { Library(chapters = emptyList(), groups = emptyList(), saved = emptyList()) },
                "mind-map-rows-chapter" to { Rows(MindMapPlace.Chapter) },
                "mind-map-rows-finish" to { Rows(MindMapPlace.Finish) },
                "study-chapter" to { Study(chapterSlide(false)) },
                "study-chapter-saved" to { Study(chapterSlide(true)) },
                "study-lesson" to {
                    val lesson = chapterLessonMaps().lessons[1]
                    Study(Slide.Lesson(UUID.fromString(mapChapter(3)), lesson))
                },
                "study-first" to { Study(chapterSlide(false), start = 0) },
                "study-last" to { Study(chapterSlide(false), start = 11) },
                "study-one" to { Study(chapterSlide(false), start = 0, count = 1) },
                "study-loading" to { Study(Slide.Loading("Waves and sound")) },
                "study-long-title" to {
                    val map = chapterMindMap("ready")
                    val title = "Grundlagen der Quantenverschränkung und ihre Anwendungen heute"
                    Study(Slide.Chapter(map.chapterId, ViewedMap(title, map.image, map.outline!!), saved = false))
                },
                "mind-map-viewer" to {
                    val map = chapterMindMap("ready")
                    MindMapViewer(ViewedMap(map.title, map.image, map.outline!!), onClose = {}, onSave = {}, onBookmark = {})
                },
                "mind-map-viewer-saved" to {
                    val map = chapterMindMap("ready")
                    MindMapViewer(ViewedMap(map.title, map.image, map.outline!!, saved = true), onClose = {}, onSave = {}, onBookmark = {})
                },
                "mind-map-viewer-text" to {
                    val map = chapterMindMap("ready", image = false)
                    MindMapViewer(ViewedMap(map.title, null, map.outline!!), onClose = {}, onSave = null)
                },
            )
    }
}
