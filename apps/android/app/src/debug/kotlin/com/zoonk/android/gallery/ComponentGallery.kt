// Debug-only samples for reviewers: never shipped, so never translated.
@file:Suppress("HardcodedComposeText")

package com.zoonk.android.gallery

import android.text.format.DateFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.PlaceIcon
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.AnswerTag
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltDot
import com.zoonk.android.ui.components.BeltLevel
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.format.formatTimeOfDay
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import java.time.LocalDate
import java.time.LocalTime

/** One part of the gallery: a primitive or a group of theme roles, with its samples. */
internal class GallerySection(
    val title: String,
    val content: @Composable () -> Unit,
)

internal val gallerySections =
    listOf(
        GallerySection("Color roles") { ColorRoles() },
        GallerySection("Type") { TypeRoles() },
        GallerySection("Material components") { MaterialComponents() },
        GallerySection("Navigation") { Navigation() },
        GallerySection("Label chips") { Chips() },
        GallerySection("Meters") { Meters() },
        GallerySection("Status marks") { StatusMarks() },
        GallerySection("Kinds") { Kinds() },
        GallerySection("Belts") { Belts() },
        GallerySection("Answer tones") { Answers() },
        GallerySection("Headers and empty states") { HeadersAndEmptyStates() },
        GallerySection("Load failed") { LoadFailedMessage(onRetry = {}) { TextButton(onClick = {}) { Text("Go to Today") } } },
        GallerySection("Formatting") { Formatting() },
    )

/** Every theme role and shared primitive in the current scheme, one section per card. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComponentGallery() {
    Scaffold(topBar = { TopAppBar(title = { Text("Design system") }) }) { padding ->
        LazyVerticalStaggeredGrid(
            columns = StaggeredGridCells.Adaptive(minSize = 320.dp),
            modifier = Modifier.fillMaxSize(),
            contentPadding = padding,
            verticalItemSpacing = 32.dp,
        ) {
            items(gallerySections, key = { it.title }) { section ->
                GallerySectionBlock(section, Modifier.padding(horizontal = 16.dp))
            }
        }
    }
}

@Composable
internal fun GallerySectionBlock(
    section: GallerySection,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = section.title,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        section.content()
    }
}

@Composable
private fun ColorRoles() {
    val colors = MaterialTheme.colorScheme
    val zoonk = MaterialTheme.zoonk

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Swatches(
            "primary" to colors.primary,
            "onSurface" to colors.onSurface,
            "onSurfaceVariant" to colors.onSurfaceVariant,
            "outline" to colors.outline,
            "outlineVariant" to colors.outlineVariant,
        )
        Swatches(
            "background" to colors.background,
            "containerLow" to colors.surfaceContainerLow,
            "container" to colors.surfaceContainer,
            "containerHigh" to colors.surfaceContainerHigh,
            "containerHighest" to colors.surfaceContainerHighest,
        )
        Swatches(
            "tertiary" to colors.tertiary,
            "tertiaryContainer" to colors.tertiaryContainer,
            "error" to colors.error,
            "errorContainer" to colors.errorContainer,
            "selectedTint" to zoonk.selectedTint,
        )
        Swatches(
            "brain" to zoonk.brain,
            "warning" to zoonk.warning,
            "energy" to zoonk.energy,
        )
        Words("Progress, +4 this week", colors.onTertiaryContainer, colors.tertiaryContainer)
        Words("Your answer", colors.onErrorContainer, colors.errorContainer)
        Words("Field error", colors.error, colors.background)
        Words("+18 Brain Power", zoonk.brainText, colors.background)
        Words("Appears a lot", zoonk.warningText, colors.background)
        Words("Snackbar", colors.inverseOnSurface, colors.inverseSurface)
    }
}

@Composable
private fun Swatches(vararg swatches: Pair<String, Color>) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        swatches.forEach { (name, color) ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    Modifier
                        .size(20.dp)
                        .background(color, MaterialTheme.shapes.extraSmall)
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.extraSmall),
                )
                Text(text = name, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun Words(
    text: String,
    color: Color,
    container: Color,
) {
    Text(
        text = text,
        modifier =
            Modifier
                .background(container, MaterialTheme.shapes.small)
                .padding(horizontal = 8.dp, vertical = 4.dp),
        color = color,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun TypeRoles() {
    val type = MaterialTheme.typography

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Learn anything", style = type.displaySmall)
        Text("Quantum physics from scratch", style = type.headlineSmall)
        Text("Today", style = type.titleLarge)
        SectionHeader("This week")
        Text("Lessons, reviews and practice in the order that fits your week.", style = type.bodyLarge)
        Text("3 lessons · 11 min", color = MaterialTheme.colorScheme.onSurfaceVariant, style = type.bodyMedium.withTabularFigures())
        Text("Try a lesson", style = type.labelLarge)
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("43", style = type.displaySmall.withTabularFigures())
            Text("min", color = MaterialTheme.colorScheme.onSurfaceVariant, style = type.titleMedium)
        }
    }
}

@Composable
private fun MaterialComponents() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {}) { Text("Continue") }
            FilledTonalButton(onClick = {}) { Text("Adjust plan") }
            TextButton(onClick = {}) { Text("Skip") }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = true, onCheckedChange = {})
            RadioButton(selected = true, onClick = {})
            RadioButton(selected = false, onClick = {})
            Switch(checked = true, onCheckedChange = {})
            Switch(checked = false, onCheckedChange = {}, modifier = Modifier.padding(start = 8.dp))
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = true,
                onClick = {},
                label = { Text("Mon") },
                leadingIcon = {
                    Icon(
                        painterResource(R.drawable.ic_check),
                        contentDescription = null,
                        Modifier.size(FilterChipDefaults.IconSize),
                    )
                },
            )
            FilterChip(selected = false, onClick = {}, label = { Text("Tue") })
            AssistChip(onClick = {}, label = { Text("Explain") })
        }
        OutlinedTextField(
            value = "",
            onValueChange = {},
            label = { Text("Your goal") },
            supportingText = { Text("Write what you want to learn") },
            isError = true,
            modifier = Modifier.fillMaxWidth(),
        )
        CircularProgressIndicator(progress = { 0.6f }, color = MaterialTheme.colorScheme.tertiary)
    }
}

@Composable
private fun Navigation() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        NavigationBar {
            listOf(PlaceIcon.Today to "Today", PlaceIcon.Plan to "Plan", PlaceIcon.Buddy to "Buddy").forEach { (place, label) ->
                val selected = place == PlaceIcon.Today
                NavigationBarItem(
                    selected = selected,
                    onClick = {},
                    icon = { Icon(painterResource(if (selected) place.selectedIcon else place.icon), contentDescription = null) },
                    label = { Text(label) },
                )
            }
        }
        listOf(
            PlaceIcon.Mistakes to "Mistakes notebook",
            PlaceIcon.Exam to "Exam",
            PlaceIcon.Speaking to "Speaking",
            PlaceIcon.MindMaps to "Mind maps",
            PlaceIcon.Statistics to "Statistics",
        ).forEach { (place, label) ->
            val selected = place == PlaceIcon.Statistics
            NavigationDrawerItem(
                label = { Text(label) },
                selected = selected,
                onClick = {},
                icon = { Icon(painterResource(if (selected) place.selectedIcon else place.icon), contentDescription = null) },
            )
        }
    }
}

@Composable
private fun Chips() {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        LabelChip("Plus")
        LabelChip("1 week")
        LabelChip("Focus")
        LabelChip(text = formatMinutes(12, currentLocale()), icon = R.drawable.ic_timer)
    }
}

@Composable
private fun Meters() {
    val colors = MaterialTheme.colorScheme
    val done = MeterPart.Fill.Solid(colors.tertiary)

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Labeled("Lesson progress, 40%") { Meter(0.4f) }
        Labeled("Energy, 70%") { Meter(0.7f, color = MaterialTheme.zoonk.energy) }
        Labeled("Brain Power to the next level") { Meter(0.3f, color = MaterialTheme.zoonk.brain) }
        Labeled("Today's blocks: two done, one in progress") {
            MeterParts(
                listOf(
                    MeterPart(done, 10f),
                    MeterPart(done, 15f),
                    MeterPart(MeterPart.Fill.Place, 12f),
                    MeterPart(MeterPart.Fill.Track, 8f),
                    MeterPart(MeterPart.Fill.Track, 20f),
                ),
            )
        }
        Labeled("A lesson's answers") {
            MeterParts(
                listOf(done, done, done, MeterPart.Fill.Solid(colors.error), done, MeterPart.Fill.Track, MeterPart.Fill.Track)
                    .map { MeterPart(it) },
            )
        }
        Labeled("A plan's time by kind") {
            MeterParts(
                listOf(
                    MeterPart(MeterPart.Fill.Solid(colors.onSurfaceVariant), 40f),
                    MeterPart(MeterPart.Fill.Solid(MaterialTheme.zoonk.kindReview), 15f),
                    MeterPart(MeterPart.Fill.Solid(MaterialTheme.zoonk.kindMock), 20f),
                    MeterPart(MeterPart.Fill.Track, 25f),
                ),
            )
        }
    }
}

@Composable
private fun Labeled(
    label: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(text = label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        content()
    }
}

@Composable
private fun StatusMarks() {
    Column {
        listOf(
            MarkStatus.Done to "Atoms and their parts",
            MarkStatus.Skipped to "Units and measures",
            MarkStatus.Next to "The periodic table",
            MarkStatus.Todo to "Chemical bonds",
        ).forEach { (status, title) ->
            ListItem(
                headlineContent = { Text(title) },
                leadingContent = { StatusMark(status) },
                colors =
                    ListItemDefaults.colors(
                        containerColor =
                            if (status == MarkStatus.Next) MaterialTheme.colorScheme.surfaceContainerHigh else Color.Transparent,
                    ),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DoneMark()
            Text("Done mark alone", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun Kinds() {
    Column {
        LearnKind.entries.forEach { kind ->
            ListItem(
                headlineContent = { Text(kind.name) },
                leadingContent = { KindMark(kind) },
                trailingContent = { KindDot(kind) },
                colors = ListItemDefaults.colors(containerColor = Color.Transparent),
            )
        }
    }
}

@Composable
private fun Belts() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Belt.entries.forEach { belt ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    BeltDot(belt)
                    Text(stringResource(belt.label), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = {}) { BeltLevel(Belt.Yellow, 3) }
            TextButton(onClick = {}) { BeltLevel(Belt.White, 10) }
            TextButton(onClick = {}) { BeltLevel(Belt.Black, 7) }
        }
    }
}

@Composable
private fun Answers() {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AnswerSample("1", "Ribosome", picked = false, result = null)
        AnswerSample("2", "Mitochondria (picked)", picked = true, result = null)
        AnswerSample("2", "Mitochondria", picked = true, result = AnswerResult.Right)
        AnswerSample("3", "Golgi apparatus", picked = false, result = AnswerResult.Right)
        AnswerSample("4", "Nucleus", picked = true, result = AnswerResult.Wrong)
        AnswerSample("1", "A guess", picked = true, result = AnswerResult.Guess)
    }
}

@Composable
private fun AnswerSample(
    key: String,
    text: String,
    picked: Boolean,
    result: AnswerResult?,
) {
    val tone = answerTone(picked, result)

    Surface(
        shape = MaterialTheme.shapes.medium,
        color = tone.container,
        contentColor = tone.contentColor,
        border = tone.border,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(key, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
            Text(text, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)

            if (result != null) {
                AnswerTag(picked = picked, result = result)
            }
        }
    }
}

@Composable
private fun HeadersAndEmptyStates() {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        SectionHeader("This week")
        EmptyState(
            icon = R.drawable.ic_edit_square,
            title = "No mistakes to practice",
            description = "Questions you get wrong land here, ready to try again.",
            action = { FilledTonalButton(onClick = {}) { Text("Start a lesson") } },
        )
    }
}

@Composable
private fun Formatting() {
    val locale = currentLocale()
    val day = LocalDate.of(2026, 10, 26)
    val is24Hour = DateFormat.is24HourFormat(LocalContext.current)

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        listOf(
            "45 minutes" to formatMinutes(45, locale),
            "45 seconds" to formatDuration(45, locale),
            "90 minutes" to formatMinutes(90, locale),
            "1234.5" to formatNumber(1_234.5, locale),
            "Brain Power earned" to formatNumber(50.0, locale, signed = true),
            "−3" to formatNumber(-3.0, locale),
            "Share 0.456" to formatPercent(0.456, locale),
            "Begun share" to formatProgressShare(0.004, locale),
            "Day" to formatDate(day, locale, today = day),
            "Weekday and day" to formatDate(day, locale, DateStyle.WeekdayDay, day),
            "13:30" to formatTimeOfDay(LocalTime.of(13, 30), locale, is24Hour),
        ).forEach { (label, value) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                Text(value, style = MaterialTheme.typography.bodyMedium.withTabularFigures())
            }
        }
    }
}

@Preview(name = "Light", heightDp = 2400)
@Composable
private fun LightPreview() = ZoonkTheme(darkTheme = false, moreContrast = false) { ComponentGallery() }

@Preview(name = "Dark", heightDp = 2400)
@Composable
private fun DarkPreview() = ZoonkTheme(darkTheme = true, moreContrast = false) { ComponentGallery() }

@Preview(name = "Light, more contrast", heightDp = 2400)
@Composable
private fun LightMoreContrastPreview() = ZoonkTheme(darkTheme = false, moreContrast = true) { ComponentGallery() }

@Preview(name = "Dark, more contrast", heightDp = 2400)
@Composable
private fun DarkMoreContrastPreview() = ZoonkTheme(darkTheme = true, moreContrast = true) { ComponentGallery() }
