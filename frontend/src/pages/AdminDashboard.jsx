import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminExpenseManagement from "../components/AdminExpenseManagement.jsx";
import AdminInsights from "../components/AdminInsights.jsx";
import AdminOrderManagement from "../components/AdminOrderManagement.jsx";
import { clearAuthToken } from "../utils/auth.js";
import Admin from "./Admin.jsx";

const SECTIONS = [
  { id: "catalog", label: "Catalog" },
  { id: "orders", label: "Orders" },
  { id: "expenses", label: "Expenses" },
  { id: "insights", label: "Insights" },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("catalog");

  return (
    <section className="section admin-shell">
      <div className="admin-shell__header">
        <div>
          <p className="eyebrow">Studio</p>
          <h1 className="section-title">Admin</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAuthToken();
            navigate("/admin/login", { replace: true });
          }}
          className="button button--outline"
        >
          Logout
        </button>
      </div>

      <nav className="admin-tabs" aria-label="Admin sections">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`admin-tabs__link${activeSection === id ? " is-active" : ""}`}
            onClick={() => setActiveSection(id)}
            aria-current={activeSection === id ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="admin-panel">
        {activeSection === "catalog" && <Admin />}
        {activeSection === "orders" && <AdminOrderManagement />}
        {activeSection === "expenses" && <AdminExpenseManagement />}
        {activeSection === "insights" && <AdminInsights />}
      </div>
    </section>
  );
};

export default AdminDashboard;
