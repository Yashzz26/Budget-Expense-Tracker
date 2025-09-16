document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Element Selectors ---
  const expenseForm = document.getElementById("expenseForm");
  const amountInput = expenseForm.querySelector('input[type="number"]');
  const dateInput = expenseForm.querySelector('input[type="date"]');
  const categorySelect = expenseForm.querySelector("select");
  const descriptionInput = expenseForm.querySelector('input[type="text"]');

  const expenseTableBody = document.querySelector(".expense-list tbody");
  const filterCategorySelect = document.querySelector(".filters select");
  const filterTimeSelect = document.querySelector(
    ".filters select:last-of-type"
  );

  // Selector for the success message (from previous UI/UX polish update)
  const successMessage = document.getElementById("successMessage");

  // Insights Panel
  const totalSpendEl = document.getElementById("totalSpend");
  const highestCategoryEl = document.getElementById("highestCategory");
  const avgSpendEl = document.getElementById("avgSpend");
  const suggestionEl = document.getElementById("suggestion");

  // Chart Canvases
  const categoryChartCanvas = document
    .getElementById("categoryChart")
    .getContext("2d");
  const trendChartCanvas = document
    .getElementById("trendChart")
    .getContext("2d");
  const pieChartCanvas = document.getElementById("pieChart").getContext("2d");

  // Chart instances
  let categoryChart, trendChart, pieChart;

  // --- Data Storage ---
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  // --- Functions ---

  /**
   * Saves the current expenses array to localStorage.
   */
  const saveExpenses = () => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  };

  /**
   * Renders the expenses in the table.
   * @param {Array} filteredExpenses - The array of expenses to display.
   */
  const renderExpenses = (filteredExpenses) => {
    expenseTableBody.innerHTML = ""; // Clear existing rows
    if (filteredExpenses.length === 0) {
      expenseTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No expenses found.</td></tr>`;
      return;
    }

    filteredExpenses.forEach((expense, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new Date(expense.date).toLocaleDateString()}</td>
        <td>₹${expense.amount.toFixed(2)}</td>
        <td>${expense.category}</td>
        <td>${expense.description}</td>
      `;
      expenseTableBody.appendChild(row);

      // Apply the highlight class to the newest expense
      if (index === 0) {
        row.classList.add("highlighted-row");
      }
    });
  };

  /**
   * Updates the insights panel with calculated data.
   * @param {Array} currentExpenses - The expenses to analyze.
   */
  const updateInsights = (currentExpenses) => {
    if (currentExpenses.length === 0) {
      totalSpendEl.textContent = "0.00";
      highestCategoryEl.textContent = "-";
      avgSpendEl.textContent = "0.00";
      suggestionEl.textContent = "Add an expense to get started!";
      return;
    }

    // Total Spend
    const totalSpend = currentExpenses.reduce(
      (sum, exp) => sum + exp.amount,
      0
    );
    totalSpendEl.textContent = totalSpend.toFixed(2);

    // Highest Category
    const categorySpends = currentExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});

    const highestCategory = Object.keys(categorySpends).reduce(
      (a, b) => (categorySpends[a] > categorySpends[b] ? a : b),
      "-"
    );
    highestCategoryEl.textContent = highestCategory;

    // Average Weekly Spend
    const firstDate = new Date(
      Math.min(...currentExpenses.map((e) => new Date(e.date)))
    );
    const lastDate = new Date(
      Math.max(...currentExpenses.map((e) => new Date(e.date)))
    );
    const weeks = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7) + 1;
    const avgWeeklySpend = totalSpend / weeks;
    avgSpendEl.textContent = avgWeeklySpend.toFixed(2);

    // Suggestion
    suggestionEl.textContent = `You're spending the most on ${highestCategory}. Consider reviewing this category.`;
  };

  /**
   * Renders all visual charts.
   * @param {Array} currentExpenses - The expenses to visualize.
   */
  const renderCharts = (currentExpenses) => {
    // Data for charts
    const categoryData = currentExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});

    const trendData = currentExpenses.reduce((acc, exp) => {
      const date = new Date(exp.date).toLocaleDateString();
      acc[date] = (acc[date] || 0) + exp.amount;
      return acc;
    }, {});

    const sortedTrendData = Object.entries(trendData).sort(
      (a, b) => new Date(a[0]) - new Date(b[0])
    );

    // Destroy old charts to prevent conflicts
    if (categoryChart) categoryChart.destroy();
    if (trendChart) trendChart.destroy();
    if (pieChart) pieChart.destroy();

    // Bar Chart: Category Breakdown
    categoryChart = new Chart(categoryChartCanvas, {
      type: "bar",
      data: {
        labels: Object.keys(categoryData),
        datasets: [
          {
            label: "Spend by Category",
            data: Object.values(categoryData),
            backgroundColor: "#1a73e8",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true },
        },
      },
    });

    // Line Chart: Spending Trend
    trendChart = new Chart(trendChartCanvas, {
      type: "line",
      data: {
        labels: sortedTrendData.map((item) => item[0]),
        datasets: [
          {
            label: "Daily Spend Trend",
            data: sortedTrendData.map((item) => item[1]),
            borderColor: "#1669c1",
            fill: false,
            tension: 0.1,
          },
        ],
      },
      options: { responsive: true },
    });

    // Pie Chart: Category Distribution
    pieChart = new Chart(pieChartCanvas, {
      type: "pie",
      data: {
        labels: Object.keys(categoryData),
        datasets: [
          {
            data: Object.values(categoryData),
            backgroundColor: [
              "#3498db",
              "#2ecc71",
              "#e74c3c",
              "#f1c40f",
              "#9b59b6",
              "#34495e",
              "#1abc9c",
            ],
          },
        ],
      },
      options: { responsive: true },
    });
  };

  /* Populates filter dropdowns with unique categories  */
  const populateFilterCategories = () => {
    const categories = [...new Set(expenses.map((exp) => exp.category))];
    filterCategorySelect.innerHTML = '<option value="All">All</option>'; // Reset
    categories.forEach((cat) => {
      const option = new Option(cat, cat);
      filterCategorySelect.add(option);
    });
  };

  /**
   * Filters expenses based on selected criteria and re-renders the UI.
   */
  const applyFilters = () => {
    const category = filterCategorySelect.value;
    const period = filterTimeSelect.value;

    let filteredExpenses = [...expenses];

    // Filter by category
    if (category !== "All") {
      filteredExpenses = filteredExpenses.filter(
        (exp) => exp.category === category
      );
    }

    // Filter by time period
    const now = new Date();
    if (period === "Weekly") {
      const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
      filteredExpenses = filteredExpenses.filter(
        (exp) => new Date(exp.date) >= oneWeekAgo
      );
    } else if (period === "Monthly") {
      const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
      filteredExpenses = filteredExpenses.filter(
        (exp) => new Date(exp.date) >= oneMonthAgo
      );
    }

    // Sort by most recent date
    filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    renderExpenses(filteredExpenses);
    updateInsights(filteredExpenses);
    renderCharts(filteredExpenses);
  };

  // --- Event Listeners ---

  // Handle adding a new category
  categorySelect.addEventListener("change", () => {
    if (categorySelect.value === "addNew") {
      const newCategory = prompt("Enter the name for the new category:");
      if (newCategory) {
        // Add to form select
        const option = new Option(newCategory, newCategory, false, true); // Create and select
        categorySelect.add(
          option,
          categorySelect.options[categorySelect.options.length - 1]
        );

        // Add to filter select
        populateFilterCategories();
      } else {
        // Reset selection if user cancels
        categorySelect.value = "";
      }
    }
  });

  // Handle new expense submission
  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const amount = parseFloat(amountInput.value);
    const date = dateInput.value;
    const category = categorySelect.value;
    const description = descriptionInput.value;

    if (!amount || !date || !category) {
      alert("Please fill in all required fields.");
      return;
    }

    const newExpense = {
      id: Date.now(),
      amount,
      date,
      category,
      description,
    };

    expenses.push(newExpense);
    saveExpenses();
    applyFilters(); // Re-render everything
    populateFilterCategories(); // Update filter options if new category was added

    // Show success message and hide after 3 seconds
    successMessage.style.display = "block";
    setTimeout(() => {
      successMessage.style.display = "none";
    }, 3000);

    expenseForm.reset();
    dateInput.valueAsDate = new Date(); // Reset date to today
  });

  // Apply filters when selection changes
  filterCategorySelect.addEventListener("change", applyFilters);
  filterTimeSelect.addEventListener("change", applyFilters);

  // --- Initial Load ---
  const initialize = () => {
    if (!dateInput.value) {
      dateInput.valueAsDate = new Date();
    }
    populateFilterCategories();
    applyFilters();
  };

  initialize();
});
