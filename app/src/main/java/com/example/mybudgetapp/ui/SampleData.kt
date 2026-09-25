package com.example.mybudgetapp.ui

import java.text.NumberFormat
import java.time.YearMonth
import java.util.Locale

// Design samples only. Room will supply real records in a later milestone.
internal data class SampleBudget(val name: String, val plannedPaisa: Long, val spentPaisa: Long)
internal data class SampleTransaction(val title: String, val detail: String, val amountPaisa: Long, val income: Boolean = false)

internal val sampleBudgets = listOf(
    SampleBudget("Food", 3000000, 1250000),
    SampleBudget("Transport", 1500000, 600000),
    SampleBudget("Shopping", 1000000, 450000),
)
internal val sampleTransactions = listOf(
    SampleTransaction("Salary", "Income · Bank account", 15000000, income = true),
    SampleTransaction("Groceries", "Food · Debit card", 1250000),
    SampleTransaction("Fuel", "Transport · Bank account", 600000),
    SampleTransaction("Clothes", "Shopping · Credit card", 450000),
)

internal fun pkr(paisa: Long): String = "PKR " + NumberFormat.getNumberInstance(Locale.US).apply {
    minimumFractionDigits = 2
    maximumFractionDigits = 2
}.format(java.math.BigDecimal.valueOf(paisa, 2))

internal fun sampleBudgetsFor(month: YearMonth, sampleMonth: YearMonth): List<SampleBudget> =
    if (month == sampleMonth) sampleBudgets else emptyList()
