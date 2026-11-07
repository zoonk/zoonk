// Debug-only samples for reviewers: never shipped, so never translated.
@file:Suppress("HardcodedComposeText")

package com.zoonk.android.gallery

import android.os.SystemClock
import android.text.format.DateFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
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
import com.zoonk.android.app.ZoonkApplication
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.ListenButton
import com.zoonk.android.feature.audio.MicrophoneOff
import com.zoonk.android.feature.audio.RecordButton
import com.zoonk.android.feature.audio.SpeechFailedNote
import com.zoonk.android.feature.audio.SpeechState
import com.zoonk.android.feature.audio.SpeechStatusIcon
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.VoiceAnswerRecorder
import com.zoonk.android.feature.audio.VoiceRecorder
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.missions.BrainPowerReward
import com.zoonk.android.navigation.PlaceIcon
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.AnswerTag
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltDot
import com.zoonk.android.ui.components.BeltLevel
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.DestructiveButton
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.FilledIconButton
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.GoalExample
import com.zoonk.android.ui.components.GoalExamples
import com.zoonk.android.ui.components.GoalRing
import com.zoonk.android.ui.components.GoalRingTrack
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.LevelBar
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.android.ui.components.OptionsButton
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.PageHeader
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.ProgressMark
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.SecondaryButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.TaskSegment
import com.zoonk.android.ui.components.TaskSegments
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.format.formatTimeOfDay
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.LocalTime

internal class GallerySection(
    val title: String,
    val content: @Composable () -> Unit,
)

internal val gallerySections =
    listOf(
        GallerySection("Color roles") { ColorRoles() },
        GallerySection("Type") { TypeRoles() },
        GallerySection("Buttons") { Buttons() },
        GallerySection("Fields") { Fields() },
        GallerySection("Material components") { MaterialComponents() },
        GallerySection("Busy buttons") { BusyButtons() },
        GallerySection("Navigation") { Navigation() },
        GallerySection("Label chips") { Chips() },
        GallerySection("Meters") { Meters() },
        GallerySection("Status marks") { StatusMarks() },
        GallerySection("Kinds") { Kinds() },
        GallerySection("Belts") { Belts() },
        GallerySection("Buddies") { Buddies() },
        GallerySection("Trickster") { Tricksters() },
        GallerySection("Acts") { Acts() },
        GallerySection("Answer tones") { Answers() },
        GallerySection("Lesson visuals") { LessonVisuals() },
        GallerySection("Question choices") { QuestionChoices() },
        GallerySection("Question statements") { QuestionStatements() },
        GallerySection("Question order and pairs") { QuestionOrderAndPairs() },
        GallerySection("Question fields") { QuestionFields() },
        GallerySection("Question feedback") { QuestionFeedbacks() },
        GallerySection("Question material") { QuestionMaterials() },
        GallerySection("Question drills") { QuestionDrills() },
        GallerySection("Headers and empty states") { HeadersAndEmptyStates() },
        GallerySection("Limit notices") { LimitNotices() },
        GallerySection("Suggestions") { Suggestions() },
        GallerySection("Load failed") { LoadFailedMessage(onRetry = {}) { TextButton(onClick = {}) { Text("Go to Today") } } },
        GallerySection("Loading") { PageLoading(Modifier.height(96.dp)) },
        GallerySection("Formatting") { Formatting() },
        GallerySection("Audio") { Audio() },
    )

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
    val roles = MaterialTheme.zoonkType
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Eyebrow("Tue, Nov 3 · ~376 days left")
        PageTitleRow("Today") { Readout("43 min left") }
        Text("Quantum physics from scratch", style = type.displaySmall)
        Text("Subjects", style = type.titleLarge)
        SectionHeader("This week", detail = factsLine("2 of 7 days", "54 min / 5 hr"))
        Text("Lessons, reviews and practice in the order that fits your week.", color = muted, style = roles.lead)
        Text("Porcentagem e descontos", style = type.bodyLarge)
        Text("The app's body: settings, notices and anything without a role.", style = type.bodyMedium)
        Text("Take a mock exam", style = type.titleSmall)
        Text("Whenever you want: a full exam with a score", color = muted, style = type.bodySmall)
        Text("33 ready to practice", color = muted, style = roles.data)
        Text("LATEST MOCK", color = MaterialTheme.zoonk.faint, style = roles.label)
        Text("What changes when a price drops by 20%?", style = roles.question)
        Text("A discount is a share of the price taken away.", style = roles.lessonText)
        Text("70%", style = type.displayMedium.withTabularFigures())
        Text("fun main() = println(\"Geist Mono\")", style = type.bodyMedium.copy(fontFamily = GeistMono))
    }
}

@Composable
private fun Buttons() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ButtonSize.entries.forEach { size ->
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {}, size = size) { Text("Continue") }
                OutlinedButton(onClick = {}, size = size) { Text("Adjust plan") }
                SecondaryButton(onClick = {}, size = size) { Text("I don't know yet") }
                TextButton(onClick = {}, size = size) { Text("Skip") }
                DestructiveButton(onClick = {}, size = size) { Text("Delete") }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {}, enabled = false) { Text("Continue") }
            OutlinedButton(onClick = {}, enabled = false) { Text("Adjust plan") }
            SecondaryButton(onClick = {}, enabled = false) { Text("I don't know yet") }
            TextButton(onClick = {}, enabled = false) { Text("Skip") }
            DestructiveButton(onClick = {}, enabled = false) { Text("Delete") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedIconButton(onClick = {}) { Icon(painterResource(R.drawable.ic_contact_support), contentDescription = "Ask") }
            OptionsButton(onClick = {}, contentDescription = "More options")
            OptionsButton(onClick = {}, contentDescription = "More options", size = ButtonSize.Large)
        }
    }
}

@Composable
private fun Fields() {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedTextField(value = "", onValueChange = {}, label = "Email", placeholder = { Text("you@example.com") }, singleLine = true)
        OutlinedTextField(value = "Ana Souza", onValueChange = {}, label = "Name", singleLine = true)
        OutlinedTextField(
            value = "ana@",
            onValueChange = {},
            label = "Email",
            supportingText = { Text("Enter a valid email address") },
            isError = true,
            singleLine = true,
        )
        OutlinedTextField(value = "", onValueChange = {}, label = "Message", placeholder = { Text("What happened?") }, minLines = 3)
        OutlinedTextField(value = "Read only", onValueChange = {}, label = "Disabled", enabled = false, singleLine = true)
        OutlinedTextField(value = "", onValueChange = {}, placeholder = { Text("Without a label") }, singleLine = true)
        GoalBox(value = "", onValueChange = {}, onSubmit = {})
        GoalBox(value = "Speak Spanish for a job interview", onValueChange = {}, onSubmit = {})
        GoalExamples(
            listOf(GoalExample("Pass the ENEM", "Exam"), GoalExample("Understand quantum physics", "Learn a topic")),
            onPick = {},
        )
    }
}

@Composable
private fun MaterialComponents() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
        CircularProgressIndicator(progress = { 0.6f }, color = MaterialTheme.colorScheme.tertiary)
    }
}

@Composable
private fun BusyButtons() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {}, busy = true) { Text("Start session") }
            OutlinedButton(onClick = {}, busy = true) { Text("Move to Monday") }
            SecondaryButton(onClick = {}, busy = true) { Text("I don't know yet") }
            TextButton(onClick = {}, busy = true) { Text("Skip") }
            DestructiveButton(onClick = {}, busy = true) { Text("Delete") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedIconButton(
                onClick = {},
                busy = true,
            ) { Icon(painterResource(R.drawable.ic_contact_support), contentDescription = "Ask") }
            FilledIconButton(onClick = {}, busy = true) { Icon(painterResource(R.drawable.ic_arrow_upward), contentDescription = "Send") }
            OutlinedButton(onClick = {}, enabled = false, focusableWhenDisabled = true) { Text("Check") }
        }
        ListRow(headline = { Text("Practice this chapter") }, onClick = {}, busy = true)
        ListRow(headline = { Text("Next lesson") }, onClick = {}, busy = true, meta = { Text("5 min") }, chevron = false)
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
        Labeled("Today's missions reward, then earned") {
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                BrainPowerReward("50", earned = false, brainPower = null)
                BrainPowerReward("50", earned = true, brainPower = null)
            }
        }
        Labeled("Today's blocks: two done, one in progress") {
            MeterParts(
                listOf(
                    MeterPart(done, 10f),
                    MeterPart(done, 15f),
                    MeterPart(MeterPart.Fill.Place(), 12f),
                    MeterPart(MeterPart.Fill.Track, 8f),
                    MeterPart(MeterPart.Fill.Track, 20f),
                ),
            )
        }
        Labeled("A lesson's answers") {
            TaskSegments(
                listOf(
                    TaskSegment.Right,
                    TaskSegment.Wrong,
                    TaskSegment.Read,
                    TaskSegment.Done,
                    TaskSegment.Current,
                    TaskSegment.Ahead,
                    TaskSegment.Ahead,
                ),
            )
        }
        Labeled("A skill's level, B1") { LevelBar(2.0) }
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
        Labeled("A week's goal rings") {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                GoalRing(1f) { DoneMark() }
                GoalRing(0.4f, track = GoalRingTrack.Today)
                GoalRing(0f, track = GoalRingTrack.Missed)
                GoalRing(0f, track = GoalRingTrack.Rest)
                GoalRing(0f)
            }
        }
        MomentReadouts(brainPower = 120, score = MomentScore(answered = 10, correct = 8), facts = listOf("5 min"))
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
            ListRow(
                headline = { Text(title) },
                highlighted = status == MarkStatus.Next,
                leading = { StatusMark(status) },
                meta = { Text("5 min") },
            )
            ListDivider()
        }
        ListRow(
            headline = { Text("Acids and bases") },
            leading = { ProgressMark(0.4f) },
            supporting = { Text("2 of 5 lessons") },
            expanded = false,
            onClick = {},
        )
        ListDivider()
        ListRow(headline = { Text("Memory") }, onClick = {}, meta = { Text("5") })
        ListDivider()
        ListRow(headline = { Text("Daily reminder") }, trailing = { Switch(checked = true, onCheckedChange = {}) })
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
            ListRow(
                headline = { Text(kind.name) },
                leading = { KindMark(kind) },
                trailing = { KindDot(kind) },
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
        listOf(
            FeedbackTone.Right to "Correct",
            FeedbackTone.Neutral to "Not graded",
            FeedbackTone.Almost to "Almost",
            FeedbackTone.Wrong to "Not quite",
        ).forEach { (tone, verdict) ->
            FeedbackPanel(label = "Feedback") {
                FeedbackVerdict(verdict, tone, end = "3 right in a row")
                if (tone == FeedbackTone.Wrong) FeedbackNote("You'll see this one again tomorrow.")
            }
        }
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
private fun LessonVisuals() {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        LessonVisual(
            LessonVisual.Chart(
                chart = LessonVisual.Chart.Kind.Bar,
                title = "Household spending by region",
                categoryLabel = "Region",
                valueLabel = "Monthly spending",
                categories = listOf("North", "Northeast", "Southeast", "South", "Center-West"),
                series =
                    listOf(
                        LessonVisual.Chart.Series("2019", listOf(2_100.0, 1_850.0, 3_400.0, 3_050.0, 2_900.0)),
                        LessonVisual.Chart.Series("2024", listOf(2_600.0, 2_200.0, 4_100.0, 3_600.0, 3_500.0)),
                    ),
                unit = "R$",
                source = "IBGE",
            ),
        )
        LessonVisual(
            LessonVisual.Chart(
                chart = LessonVisual.Chart.Kind.Line,
                title = "Average rainfall in Recife",
                categoryLabel = "Month",
                valueLabel = "Rain",
                categories = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun"),
                series = listOf(LessonVisual.Chart.Series("Rain", listOf(110.0, 152.0, 265.0, 326.0, 329.0, 390.0))),
                unit = "mm",
            ),
        )
        LessonVisual(
            LessonVisual.Timeline(
                title = "Brazil becomes a republic",
                events =
                    listOf(
                        LessonVisual.Timeline.Event("1822", "Independence", "Dom Pedro I declares it on September 7."),
                        LessonVisual.Timeline.Event("1888", "Abolition of slavery"),
                        LessonVisual.Timeline.Event("1889", "Proclamation of the Republic", "The monarchy ends."),
                    ),
            ),
        )
    }
}

@Composable
private fun HeadersAndEmptyStates() {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        PageTitleRow("Plan", verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = {}, size = ButtonSize.Small) { Text("Adjust plan") }
        }
        PageHeader("Profile", "Your name and username, your data, and your account.")
        SectionHeader("This week")
        EmptyState(
            icon = R.drawable.ic_edit_square,
            title = "No mistakes to practice",
            description = "Questions you get wrong land here, ready to try again.",
            action = { OutlinedButton(onClick = {}) { Text("Start a lesson") } },
        )
    }
}

@Composable
private fun LimitNotices() {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        listOf(
            Limit.Reached(LimitTier.Guest, LimitPeriod.Day) to LimitSubject.Help,
            Limit.Reached(LimitTier.Free, LimitPeriod.Month) to LimitSubject.Help,
            Limit.Reached(LimitTier.Plus) to LimitSubject.Help,
            Limit.SlowDown(30) to LimitSubject.Lessons,
            Limit.Reached(LimitTier.Free, LimitPeriod.Day) to LimitSubject.Calls,
        ).forEach { (limit, subject) -> LimitNotice(limit, subject, onCreateAccount = {}, onSeePlus = {}) }
    }
}

@Composable
private fun Suggestions() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Suggestion("Plan suggestion", "Your time covers 80% of the exam by Nov 7", SuggestionLayout.Line) {
            SuggestionHeader("Your time covers 80% of the exam")
            SuggestionDescription("About 25 more minutes a day covers all of it.")
            SuggestionActions { SuggestionAction("Use 1 hr a day", onClick = {}) }
        }
        Suggestion(
            "Plan suggestion",
            "Daily time changed to 1 hr.",
            SuggestionLayout.Line,
            mark = SuggestionMark.Done,
            answered = true,
            lineAction = { SuggestionAction("Undo", onClick = {}) },
        ) {}
        Suggestion(
            "Learn Python is paused",
            "Learn Python is paused",
            SuggestionLayout.Panel,
            mark = SuggestionMark.Symbol(R.drawable.ic_pause),
        ) {
            SuggestionHeader("Learn Python is paused")
            SuggestionDescription("Nothing is planned until you resume it.")
            SuggestionActions {
                SuggestionAction("Resume", onClick = {})
                SuggestionAction("Adjust plan", onClick = {}, secondary = true)
            }
        }
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
            "R$ 3.50" to formatAmount(3.5, locale, "R$"),
            "2000 compact" to formatAmount(2_000.0, locale, compact = true),
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

@Composable
private fun Audio() {
    val navigator = rememberAppNavigator()
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val audio = rememberSpokenAudio((LocalContext.current.applicationContext as ZoonkApplication).container.speech, "it")
            ListenButton(audio, listOf(SpokenText("Ciao")), "Listen")
            listOf(SpeechState.Loading, SpeechState.Playing, SpeechState.Failed(null)).forEach { state ->
                OutlinedButton(onClick = {}) {
                    SpeechStatusIcon(state) {
                        Icon(painterResource(R.drawable.ic_volume_up), contentDescription = null, Modifier.size(buttonIconSize()))
                    }
                    Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                    Text("Listen")
                }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            RecordButton(VoiceRecorder.Status.Idle, level = { 0f }, onStart = {}, onStop = {})
            RecordButton(VoiceRecorder.Status.Recording(SystemClock.elapsedRealtime() - 7_000), level = { 0.6f }, onStart = {}, onStop = {})
        }
        VoiceAnswerRecorder(
            grade = { recording ->
                delay(800)
                if (recording.durationMs < 2_000) GradeOutcome.NoSpeech else GradeOutcome.Failed
            },
            onGraded = { _: Unit -> },
            navigator = navigator,
        )
        SpeechFailedNote(language = "it", limit = null, onRetry = {}, navigator = navigator, text = "Vorrei un caffè, per favore.")
        SpeechFailedNote(language = "it", limit = Limit.SignUpRequired, onRetry = {}, navigator = navigator)
        MicrophoneOff(stringResource(R.string.audio_microphone_off_answer))
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
