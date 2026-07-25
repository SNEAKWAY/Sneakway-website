import { useEffect, useMemo, useState } from "react";
import { getAuthHeader } from "../utils/auth.js";
import {
  computeSplitInsights,
  formatMoney,
} from "../utils/adminFinance.js";

const API_URL = import.meta.env.VITE_API_URL;

const ChannelInsights = ({ title, subtitle, data }) => {
  const { orderStats, monthlyHistory } = data;

  return (
    <section className="insights-channel">
      <div>
        <h3 className="insights-channel__title">{title}</h3>
        <p className="insights-channel__subtitle">{subtitle}</p>
      </div>

      <div className="insights-grid insights-grid--channel">
        <article className="insight-card insight-card--highlight">
          <p className="insight-card__label">Orders this month</p>
          <p className="insight-card__value">{orderStats.monthOrders}</p>
          <p className="insight-card__hint">{orderStats.currentMonthLabel}</p>
        </article>
        <article className="insight-card">
          <p className="insight-card__label">Revenue (month)</p>
          <p className="insight-card__value">
            {formatMoney(orderStats.monthRevenue)}
          </p>
          <p className="insight-card__hint">Customer price total</p>
        </article>
        <article className="insight-card">
          <p className="insight-card__label">Profit (month)</p>
          <p className="insight-card__value">
            {formatMoney(orderStats.monthProfit)}
          </p>
          <p className="insight-card__hint">
            Avg {formatMoney(orderStats.averageProfit)} per order
          </p>
        </article>
        <article className="insight-card">
          <p className="insight-card__label">All-time orders</p>
          <p className="insight-card__value">{orderStats.totalOrders}</p>
          <p className="insight-card__hint">
            Revenue {formatMoney(orderStats.totalRevenue)}
          </p>
        </article>
        <article className="insight-card insight-card--highlight">
          <p className="insight-card__label">All-time profit</p>
          <p className="insight-card__value">
            {formatMoney(orderStats.totalProfit)}
          </p>
          <p className="insight-card__hint">From this channel only</p>
        </article>
      </div>

      <div className="form order-status-panel" style={{ marginTop: "28px" }}>
        <div className="form__title">
          <h2>This month snapshot</h2>
        </div>
        <ul className="order-status-list">
          <li>
            <span>Month</span>
            <strong>{orderStats.currentMonthLabel}</strong>
          </li>
          <li>
            <span>Orders</span>
            <strong>{orderStats.monthOrders}</strong>
          </li>
          <li>
            <span>Revenue</span>
            <strong>{formatMoney(orderStats.monthRevenue)}</strong>
          </li>
          <li>
            <span>Profit</span>
            <strong>{formatMoney(orderStats.monthProfit)}</strong>
          </li>
          <li>
            <span>Margin</span>
            <strong>
              {orderStats.monthRevenue > 0
                ? `${Math.round(
                    (orderStats.monthProfit / orderStats.monthRevenue) * 100,
                  )}%`
                : "—"}
            </strong>
          </li>
        </ul>
      </div>

      {monthlyHistory.length > 0 && (
        <div className="insights-history">
          <h3 className="insights-history__title">Monthly overview</h3>
          <div className="insights-history__table-wrap">
            <table className="insights-history__table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {monthlyHistory.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.count}</td>
                    <td>{formatMoney(row.revenue)}</td>
                    <td>{formatMoney(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

const AdminInsights = () => {
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const headers = getAuthHeader();
        const [ordersRes, expensesRes] = await Promise.all([
          fetch(`${API_URL}/orders`, { headers }),
          fetch(`${API_URL}/expenses`, { headers }),
        ]);

        if (ordersRes.ok) {
          const data = await ordersRes.json();
          setOrders(Array.isArray(data) ? data : []);
        }
        if (expensesRes.ok) {
          const data = await expensesRes.json();
          setExpenses(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to load insights data", error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const split = useMemo(
    () => computeSplitInsights(orders, expenses),
    [orders, expenses],
  );

  if (isLoading) {
    return <div className="loading">Loading insights...</div>;
  }

  const { expenses: expenseStats } = split;

  return (
    <div className="admin-insights">
      <div>
        <h2 className="section-title">Insights</h2>
        <p className="section-subtitle">
          Retail and reselling are tracked separately — revenue, profit, and
          monthly totals for each channel.
        </p>
      </div>

      <div className="insights-grid insights-grid--expenses" style={{ marginTop: "28px" }}>
        <article className="insight-card">
          <p className="insight-card__label">Expenses this month</p>
          <p className="insight-card__value">
            {formatMoney(expenseStats.monthAmount)}
          </p>
          <p className="insight-card__hint">
            {expenseStats.monthCount} entries · shared across business
          </p>
        </article>
        <article className="insight-card">
          <p className="insight-card__label">All-time expenses</p>
          <p className="insight-card__value">
            {formatMoney(expenseStats.totalAmount)}
          </p>
          <p className="insight-card__hint">
            {expenseStats.entryCount} total entries
          </p>
        </article>
      </div>

      <ChannelInsights
        title="Retail insights"
        subtitle="Orders marked as retail. Older orders without a type count as retail."
        data={split.retail}
      />

      <ChannelInsights
        title="Reselling insights"
        subtitle="Orders marked as reselling only. Bills are not generated for this channel."
        data={split.reselling}
      />
    </div>
  );
};

export default AdminInsights;
