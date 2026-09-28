package com.example.mybudgetapp.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.util.Locale

/** Draws actual sample spending proportions, not the assigned budget amounts. */
@Composable
internal fun ExpensePieChart(budgets: List<SampleBudget>) {
    val expenses = budgets.filter { it.spentPaisa > 0 }
    val total = expenses.sumOf { it.spentPaisa }
    if (total == 0L) {
        Text("No expenses to chart this month.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium)
        return
    }
    val colors = listOf(Color(0xFF3B9D83), Color(0xFFE8AD51), Color(0xFF8584D8), Color(0xFFCF7892))
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Canvas(Modifier.size(152.dp).align(Alignment.CenterHorizontally)
            .semantics { contentDescription = "Expense pie chart. Category amounts and percentages are listed below." }) {
            var start = -90f
            expenses.forEachIndexed { index, expense ->
                val sweep = (expense.spentPaisa.toDouble() / total * 360).toFloat()
                drawArc(color = colors[index % colors.size], startAngle = start,
                    sweepAngle = sweep, useCenter = true)
                start += sweep
            }
        }
        expenses.forEachIndexed { index, expense ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(10.dp).background(colors[index % colors.size], CircleShape))
                Text(expense.name, Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                val percentage = String.format(Locale.ENGLISH, "%.1f%%", expense.spentPaisa.toDouble() / total * 100)
                Text("${pkr(expense.spentPaisa)} · $percentage", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
