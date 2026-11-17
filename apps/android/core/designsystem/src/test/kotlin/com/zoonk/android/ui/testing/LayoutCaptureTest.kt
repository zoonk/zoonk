package com.zoonk.android.ui.testing

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.FullScreenDialog
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.fadingHorizontalScroll
import com.zoonk.android.ui.components.listRowDescription
import com.zoonk.android.ui.theme.ZoonkTheme
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** What a render's layout capture says about a list row, and what it refuses to say. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class LayoutCaptureTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private var shots: String? = null

    @Before
    fun writeLayouts() {
        shots = System.getProperty("zoonk.shots")
        System.setProperty("zoonk.shots", folder.root.path)
    }

    @After
    fun restore() {
        shots?.let { System.setProperty("zoonk.shots", it) } ?: System.clearProperty("zoonk.shots")
    }

    @Test
    fun enlargedKindMarksStayOnTheirLabelsCapMiddle() {
        RuntimeEnvironment.setFontScale(2f)
        val elements =
            capture {
                LearnKind.entries.forEach { kind ->
                    ListRow(headline = { Text(kind.name) }, leading = { KindMark(kind) })
                }
            }.elements()
        elements.filter { it.optString("part") == "row" }.forEach { row ->
            val own = elements.filter { it.optString("row") == row.getString("id") }
            val label = own.first { it.optString("part") == "label" }
            val mark = own.first { it.optString("part") == "mark" }.getJSONArray("ink")
            val labelMiddle = (label.getDouble("capTop") + label.getDouble("capBottom")) / 2
            val markMiddle = mark.getDouble(1) + mark.getDouble(3) / 2
            assertEquals(label.getString("text"), labelMiddle, markMiddle, 1.0 + 0.5 / 3)
        }
    }

    @Test
    fun clearedContainersStillExposeTheirDescendantsToTheUnmergedCapture() {
        val parts =
            capture {
                Box(Modifier.clearAndSetSemantics {}) { Text("Legend entry") }
            }
        assertTrue(parts.elements().any { it.optString("part") == "text" && it.optString("text") == "Legend entry" })
        val report = JSONObject(File(folder.root, "row.json").readText())
        assertFalse(report.has("notMeasurable"))
        assertEquals(4, report.getJSONArray("measuredRules").length())
    }

    @Test
    fun intentionallyClearedAnnotationsDeclareLimitsWithTheirElement() {
        capture {
            Text("Axis caption", Modifier.clearAndSetSemantics {})
            Text("Readable elsewhere")
        }
        val report = JSONObject(File(folder.root, "row.json").readText())
        assertFalse(report.has("notMeasurable"))
        val measured = report.getJSONArray("measuredRules")
        assertEquals(
            setOf("cut", "line-end", "lone-word", "one-height"),
            (0 until measured.length()).map { measured.getString(it) }.toSet(),
        )
        val readable = report.getJSONArray("elements").elements().first { it.optString("text") == "Readable elsewhere" }
        assertEquals("Readable elsewhere", readable.getJSONArray("lineTexts").getString(0))
        val area = report.getJSONArray("elements").part("unmeasured")
        assertTrue(area.getString("reason").contains("clearAndSetSemantics"))
    }

    @Test
    fun pageRulesReadActualTextLinesAndEveryButtonLook() {
        val parts =
            capture {
                ListRow(headline = { Text("Monday —\nFriday") })
                OutlinedButton(onClick = {}) { Text("Continue") }
            }
        val text = parts.elements().first { it.optString("part") == "text" && it.optString("text").startsWith("Monday") }
        assertEquals(
            listOf("Monday —", "Friday"),
            (0 until text.getJSONArray("lineTexts").length()).map {
                text.getJSONArray("lineTexts").getString(it)
            },
        )
        assertEquals("label", text.getString("textRole"))
        assertTrue(parts.has("control"))
    }

    @Test
    fun aGhostButtonsTransparentEdgePaddingDoesNotCountAsCutContent() {
        val parts =
            capture {
                Box(Modifier.fillMaxWidth().clipToBounds()) {
                    TextButton(onClick = {}, edge = ButtonEdge.Start) { Text("Report a problem") }
                }
            }
        assertFalse(parts.elements().any { it.optString("part") == "cut" })
    }

    @Test
    fun aGhostButtonWhoseWordsAreCutStillReportsItsControl() {
        val parts =
            capture {
                Box(Modifier.width(40.dp).height(12.dp).clipToBounds()) {
                    TextButton(
                        onClick = {},
                        modifier = Modifier.requiredWidth(200.dp).requiredHeight(48.dp),
                    ) { Text("Report a problem", softWrap = false) }
                }
            }
        assertTrue(
            parts.toString(),
            parts.elements().any {
                it.optString("part") == "cut" &&
                    it.optString("name") == "control's visible box" &&
                    it.optString("text") == "Report a problem"
            },
        )
    }

    @Test
    fun aPagedDeckIsNotAContinuousHorizontalScroller() {
        val parts =
            capture {
                HorizontalPager(state = rememberPagerState { 3 }, modifier = Modifier.width(200.dp).height(100.dp)) {
                    Text("Page $it")
                }
            }
        assertFalse(parts.elements().any { it.optString("reason") == "horizontal scroll has no kit scroll sign" })
    }

    @Test
    fun clippingAndUnsignedScrollsAreRecordedButTheKitFadeIsAllowed() {
        val parts =
            capture {
                Box(Modifier.width(40.dp).height(12.dp).clipToBounds()) {
                    Text("Content that continues", softWrap = false)
                }
                Row(Modifier.width(40.dp).horizontalScroll(rememberScrollState())) { Text("Content that scrolls") }
                Row(Modifier.width(40.dp).fadingHorizontalScroll(rememberScrollState())) { Text("Content with the kit sign") }
            }
        val cuts = parts.elements().filter { it.optString("part") == "cut" }
        assertTrue(cuts.any { it.optString("text") == "Content that continues" })
        assertEquals(1, cuts.count { it.optString("reason") == "horizontal scroll has no kit scroll sign" })
    }

    @Test
    fun aRowsPartsCarryTheirBoundsLinesAndTheFontsCapHeight() {
        val parts = capture { ListRow(headline = { Text("Mixed practice") }, meta = { Text("12 min") }, onClick = {}) }

        val label = parts.part("label")
        val value = parts.part("value")
        assertEquals("Mixed practice", label.getString("text"))
        assertEquals(1, label.getInt("lines"))
        assertEquals("Geist 14 500 20", label.getString("type"))
        assertEquals("GeistMono 12 400 16", value.getString("type"))
        // Geist's capitals are 710 of its 1000 units, read from the font file, not from the words' ink.
        assertEquals(14 * 0.71, label.getDouble("capBottom") - label.getDouble("capTop"), 0.01)
        assertEquals(label.getDouble("baseline"), label.getDouble("capBottom"), 0.0)
        assertTrue(parts.has("end"))
        assertEquals(false, parts.part("row").getBoolean("note"))
    }

    @Test
    fun aRowThatReplacesItsChildrensSemanticsKeepsItsReadableParts() {
        val parts =
            capture {
                ListRow(
                    headline = { Text("Mixed practice") },
                    meta = { Text("12 min") },
                    modifier = Modifier.clearAndSetSemantics { contentDescription = "Mixed practice, 12 minutes" },
                )
            }

        assertFalse(parts.has("unmeasured"))
        assertEquals("Mixed practice", parts.part("label").getString("text"))
        assertEquals("12 min", parts.part("value").getString("text"))
    }

    @Test
    fun clippedTextKeepsItsBaselineAndHasNoInk() {
        val parts =
            capture {
                Box(Modifier.height(10.dp).clipToBounds()) {
                    ListRow(headline = { Text("Mixed practice") }, meta = { Text("12 min") })
                }
            }

        listOf(parts.part("label"), parts.part("value")).forEach { text ->
            assertEquals(NOT_MEASURED, text.getString("ink"))
            // Laid out from the font, not read from pixels: still real when the pixels are cut off.
            assertTrue(text.get("baseline") is Number)
        }
    }

    /** Japanese and Korean have no capitals: they're set on their ideographic face, read through the font that drew them. */
    @Test
    fun textWithNoCapitalsIsSetOnItsIdeographicFace() {
        val labels =
            capture {
                ListRow(headline = { Text("日本語の練習") })
                ListRow(headline = { Text("한국어 연습") })
            }.elements().filter { it.getString("part") == "label" }

        assertEquals(2, labels.size)
        labels.forEach { label ->
            assertEquals("ideographic face", label.getString("textBox"))
            val top = label.getDouble("capTop")
            val bottom = label.getDouble("capBottom")
            val box = label.getJSONArray("bounds")
            // The face sits about on the line box's middle (main measured within 0.4px).
            assertEquals(box.getDouble(1) + box.getDouble(3) / 2, (top + bottom) / 2, 1.5)
        }
    }

    /** Arabic has no capitals and no ideographic face: its middle isn't measured. */
    @Test
    fun textAFallbackFontDrewWithNoFaceToReadHasNoCapitals() {
        val label = capture { ListRow(headline = { Text("مرحبا بالعالم") }) }.part("label")

        assertEquals(NOT_MEASURED, label.getString("capTop"))
        assertEquals(NOT_MEASURED, label.getString("capBottom"))
        assertTrue(label.get("baseline") is Number)
    }

    @Test
    fun aPictureWithoutItsFramesCaptureSaysItIsNotMeasured() {
        compose.setContent { ZoonkTheme { ListRow(headline = { Text("Copy") }) } }
        val copy =
            compose
                .onRoot()
                .captureRender()
                .asAndroidBitmap()
                .copy(Bitmap.Config.ARGB_8888, true)
        writeRender(File(folder.root, "copied.png"), copy)

        val record = JSONObject(File(folder.root, "copied.json").readText())
        assertEquals("copied.png", record.getJSONObject("picture").getString("file"))
        assertEquals(NOT_MEASURED, record.getString("elements"))
        assertTrue(record.getString("reason").isNotEmpty())
    }

    @Test
    fun textClippedInsideItsOwnPartHasNoInk() {
        val label =
            capture {
                ListRow(headline = { Box(Modifier.height(10.dp).clipToBounds()) { Text("Clipped inside label") } })
            }.part("label")

        assertEquals(NOT_MEASURED, label.getString("ink"))
        assertTrue(label.getBoolean("clipped"))
        assertTrue(label.get("baseline") is Number)
    }

    @Test
    fun textUnderAnOpaqueSiblingHasNoInk() {
        val label =
            capture {
                Box {
                    ListRow(headline = { Text("Covered row") })
                    Box(Modifier.fillMaxWidth().height(60.dp).background(Color.Blue))
                }
            }.part("label")

        assertEquals(NOT_MEASURED, label.getString("ink"))
        assertTrue(label.get("baseline") is Number)
    }

    @Test
    fun anEmptyDescriptionIsNeitherDrawnNorCounted() {
        val rows =
            capture {
                ListRow(headline = { Text("Empty first") }, leading = { Text("A") }, supporting = {
                    Text("")
                    Text("Only description")
                })
                ListRow(headline = { Text("One only") }, leading = { Text("A") }, supporting = { Text("Only description") })
            }.elements()
        val (withEmpty, alone) = rows.filter { it.getString("part") == "row" }.map { it.getJSONArray("bounds").getDouble(3) }
        val marks = rows.filter { it.getString("part") == "mark" }
        val rowTops = rows.filter { it.getString("part") == "row" }.map { it.getJSONArray("bounds").getDouble(1) }

        assertEquals(alone, withEmpty, 0.01)
        assertEquals(
            marks[1].getJSONArray("bounds").getDouble(1) - rowTops[1],
            marks[0].getJSONArray("bounds").getDouble(1) - rowTops[0],
            0.01,
        )
        rows.filter { it.getString("part") == "note" }.forEach { assertEquals(1, it.getInt("texts")) }
    }

    @Test
    fun aPartWithNoWordsCountsNoTexts() {
        val label = capture { ListRow(headline = { Text("") }) }.part("label")

        assertEquals(0, label.getInt("texts"))
    }

    /** RV39 A1: the negative control. Visible words keep their ink, ellipsized or aligned. */
    @Test
    fun ordinaryVisibleTextKeepsItsInk() {
        val parts =
            capture {
                listOf("I", "Normal").forEach { word -> ListRow(headline = { Text(word) }, meta = { Text("12 min") }, onClick = {}) }
                ListRow(
                    headline = {
                        Text(
                            "A title long enough to end in an ellipsis on a phone, with more words after it",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                )
                ListRow(headline = { Text("Centered", Modifier.fillMaxWidth(), textAlign = TextAlign.Center) })
            }.elements().filter { it.getString("part") == "label" || it.getString("part") == "value" }

        assertEquals(6, parts.size)
        parts.forEach { part ->
            assertTrue(part.getString("text"), part.get("ink") is JSONArray)
            assertFalse(part.getString("text"), part.has("clipped"))
        }
    }

    /** RV39 A1: a text box cut only where it has no words still shows every line. */
    @Test
    fun textWhoseBoxIsCutOnlyPastItsWordsKeepsItsInk() {
        val label =
            capture {
                ListRow(
                    headline = {
                        Box(Modifier.width(120.dp).clipToBounds()) {
                            Text("Hi", Modifier.wrapContentWidth(Alignment.Start, unbounded = true).width(400.dp))
                        }
                    },
                )
            }.part("label")

        assertTrue(label.get("ink") is JSONArray)
    }

    /** RV39 A2: what covers the words, varied or partial, is never their ink. */
    @Test
    fun wordsUnderAGradientOrHalfCoveredHaveNoInk() {
        val labels =
            capture {
                Box {
                    ListRow(headline = { Text("Hidden by gradient", Modifier.fillMaxWidth()) })
                    Box(Modifier.fillMaxWidth().height(80.dp).background(Brush.verticalGradient(listOf(Color.Blue, Color.Red))))
                }
                Box {
                    ListRow(headline = { Text("Only half the label is visible") })
                    Box(Modifier.fillMaxWidth(0.2f).height(80.dp).background(Color.Blue))
                }
            }.elements().filter { it.getString("part") == "label" }

        assertEquals(2, labels.size)
        labels.forEach { label ->
            assertEquals(label.getString("text"), NOT_MEASURED, label.getString("ink"))
            assertTrue(label.get("lineBounds") is JSONArray)
        }
    }

    /** RV39 A3: a blank description is no description, and the count is the row's own. */
    @Test
    fun aBlankDescriptionMakesNoLineAndTheCountIsTheRowsOwn() {
        val rows =
            capture {
                ListRow(headline = { Text("Whitespace") }, leading = { Text("A") }, supporting = listRowDescription("   "))
                ListRow(headline = { Text("Alone") }, leading = { Text("A") })
                ListRow(headline = { Text("Zero width") }, leading = { Text("A") }, supporting = {
                    Text("\u200b")
                    Text("Only description")
                })
                ListRow(headline = { Text("Control") }, leading = { Text("A") }, supporting = { Text("Only description") })
                ListRow(headline = { Text("Sized box") }, leading = { Text("A") }, supporting = {
                    Box(Modifier.fillMaxWidth().height(20.dp))
                    Text("Only description")
                })
            }.elements()
        val heights = rows.filter { it.getString("part") == "row" }.map { it.getJSONArray("bounds").getDouble(3) }
        val notes = rows.filter { it.getString("part") == "note" }

        assertEquals(heights[1], heights[0], 0.01)
        assertEquals(heights[3], heights[2], 0.01)
        assertEquals(listOf(1, 1, 2), notes.map { it.getInt("texts") })
    }

    /** RV39 A4: a text whose layout semantics hide is an unknown count, never zero. */
    @Test
    fun wordsWhoseLayoutIsHiddenAreAnUnknownCount() {
        val parts =
            capture {
                ListRow(headline = {
                    Text("Brazil", Modifier.clearAndSetSemantics {})
                }, supporting = { Text("Home country", Modifier.clearAndSetSemantics {}) })
            }

        assertEquals(NOT_MEASURED, parts.part("label").getString("texts"))
        assertEquals(1, parts.part("note").getInt("texts"))
    }

    /** RV39: a dimmed control whose edge the picture can't show has no edge, rather than the letters' edge. */
    @Test
    fun aDimmedPartWhoseEdgeCantBeSeenHasNoInk() {
        val (dimmed, shown) =
            capture {
                ListRow(
                    headline = { Text("Disabled control") },
                    trailing = { OutlinedButton(onClick = {}, enabled = false) { Text("Save") } },
                )
                // The control: the same button enabled shows its border, so its edge is a number.
                ListRow(headline = { Text("Enabled control") }, trailing = { OutlinedButton(onClick = {}) { Text("Save") } })
            }.elements().filter { it.getString("part") == "end" }

        assertEquals(NOT_MEASURED, dimmed.getString("ink"))
        assertTrue(shown.get("ink") is JSONArray)
    }

    /** In a right-to-left layout an English label starts on the left of its box, where it's drawn. */
    @Test
    fun englishInARightToLeftLayoutIsMeasuredWhereItIsDrawn() {
        val label =
            capture {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    ListRow(headline = { Text("Mixed practice", Modifier.wrapContentWidth()) })
                }
            }.part("label")

        assertEquals(label.getJSONArray("bounds").getDouble(0), label.getJSONArray("lineBounds").getDouble(0), 1.0)
        assertTrue(label.get("ink") is JSONArray)
    }

    @Test
    fun aDialogsRenderIsTheDialogNotThePageBehindIt() {
        compose.setContent {
            ZoonkTheme {
                Box(Modifier.fillMaxSize().background(PAGE))
                Dialog(onDismissRequest = {}) {
                    Surface(shape = MaterialTheme.shapes.large) {
                        Column(Modifier.padding(24.dp)) { ListRow(headline = { Text("Take the shorter mock") }) }
                    }
                }
            }
        }
        compose.waitForIdle()
        val picture =
            compose
                .onAllNodes(isRoot())
                .onLast()
                .captureRender()
                .asAndroidBitmap()
        writeRender(File(folder.root, "dialog.png"), picture)
        val label = JSONObject(File(folder.root, "dialog.json").readText()).getJSONArray("elements").part("label")

        assertEquals("Take the shorter mock", label.getString("text"))
        // Ink is written only where the picture shows the words in their own color: a copy of the page has none.
        assertTrue(label.get("ink") is JSONArray)
        assertTrue((0 until picture.width).none { x -> picture.getPixel(x, picture.height / 2) == PAGE.toArgb() })
    }

    @Test
    fun aDialogThatFillsTheWindowIsCutToItsWindow() {
        compose.setContent {
            ZoonkTheme {
                FullScreenDialog(onDismissRequest = {}) { Box(Modifier.fillMaxSize().background(PAGE)) }
            }
        }
        compose.waitForIdle()
        val picture = compose.onNode(isDialog()).captureRender().asAndroidBitmap()

        assertEquals(compose.activity.window.decorView.width, picture.width)
        assertEquals(PAGE.toArgb(), picture.getPixel(picture.width / 2, picture.height / 2))
    }

    private fun capture(content: @androidx.compose.runtime.Composable () -> Unit): JSONArray {
        compose.setContent { ZoonkTheme { Column { content() } } }
        val file = File(folder.root, "row.png")
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
        return JSONObject(File(folder.root, "row.json").readText()).getJSONArray("elements")
    }

    private fun JSONArray.elements() = (0 until length()).map { getJSONObject(it) }

    private fun JSONArray.has(part: String) = elements().any { it.getString("part") == part }

    private fun JSONArray.part(part: String) = elements().first { it.getString("part") == part }
}

private const val NOT_MEASURED = "not measured"

/** A page color no dialog draws, so a picture of the page behind it is told from the dialog. */
private val PAGE = Color(0xFFFF00FF)
