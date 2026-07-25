export const formatMoney = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

export const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const formatMonthLabel = (key) => {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

export const normalizeOrderType = (value) =>
  value === "reselling" ? "reselling" : "retail";

export const splitOrdersByType = (orders) => {
  const retail = [];
  const reselling = [];

  for (const order of orders) {
    if (normalizeOrderType(order.orderType) === "reselling") {
      reselling.push(order);
    } else {
      retail.push(order);
    }
  }

  return { retail, reselling };
};

export const computeOrderInsights = (orders) => {
  const now = new Date();
  const currentKey = monthKey(now);
  let totalOrders = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let monthOrders = 0;
  let monthRevenue = 0;
  let monthProfit = 0;
  const byMonth = {};

  for (const order of orders) {
    const price = Number(order.customerPrice) || 0;
    const profit = Number(order.profit) || 0;
    const date = order.createdAt ? new Date(order.createdAt) : new Date();
    const key = monthKey(date);

    totalOrders += 1;
    totalRevenue += price;
    totalProfit += profit;

    if (!byMonth[key]) {
      byMonth[key] = { count: 0, revenue: 0, profit: 0 };
    }
    byMonth[key].count += 1;
    byMonth[key].revenue += price;
    byMonth[key].profit += profit;

    if (key === currentKey) {
      monthOrders += 1;
      monthRevenue += price;
      monthProfit += profit;
    }
  }

  const monthlyHistory = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, stats]) => ({
      key,
      label: formatMonthLabel(key),
      ...stats,
    }));

  return {
    currentMonthLabel: formatMonthLabel(currentKey),
    monthOrders,
    monthRevenue,
    monthProfit,
    totalOrders,
    totalRevenue,
    totalProfit,
    averageProfit:
      totalOrders > 0 ? Math.round(totalProfit / totalOrders) : 0,
    monthlyHistory,
  };
};

export const computeExpenseInsights = (expenses) => {
  const now = new Date();
  const currentKey = monthKey(now);
  let totalAmount = 0;
  let monthAmount = 0;
  let monthCount = 0;
  const byMonth = {};

  for (const expense of expenses) {
    const amount = Number(expense.amount) || 0;
    const date = expense.createdAt ? new Date(expense.createdAt) : new Date();
    const key = monthKey(date);

    totalAmount += amount;

    if (!byMonth[key]) {
      byMonth[key] = { count: 0, amount: 0 };
    }
    byMonth[key].count += 1;
    byMonth[key].amount += amount;

    if (key === currentKey) {
      monthAmount += amount;
      monthCount += 1;
    }
  }

  const monthlyHistory = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, stats]) => ({
      key,
      label: formatMonthLabel(key),
      ...stats,
    }));

  return {
    currentMonthLabel: formatMonthLabel(currentKey),
    totalAmount,
    monthAmount,
    monthCount,
    entryCount: expenses.length,
    monthlyHistory,
  };
};

export const computeChannelInsights = (orders) => {
  const orderStats = computeOrderInsights(orders);
  return {
    orderStats,
    monthlyHistory: orderStats.monthlyHistory,
  };
};

export const computeSplitInsights = (orders, expenses) => {
  const { retail, reselling } = splitOrdersByType(orders);
  return {
    retail: computeChannelInsights(retail),
    reselling: computeChannelInsights(reselling),
    expenses: computeExpenseInsights(expenses),
  };
};

export const computeCombinedInsights = (orders, expenses) => {
  const orderStats = computeOrderInsights(orders);
  const expenseStats = computeExpenseInsights(expenses);
  return {
    orderStats,
    expenseStats,
    monthNet: orderStats.monthProfit - expenseStats.monthAmount,
    allTimeNet: orderStats.totalProfit - expenseStats.totalAmount,
    combinedMonthly: orderStats.monthlyHistory,
  };
};
