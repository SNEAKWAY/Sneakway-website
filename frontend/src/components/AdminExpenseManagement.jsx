import { useEffect, useMemo, useState } from "react";
import { getAuthHeader } from "../utils/auth.js";
import { formatMoney } from "../utils/adminFinance.js";

const API_URL = import.meta.env.VITE_API_URL;

const emptyExpenseForm = {
  id: null,
  name: "",
  amount: "",
};

const AdminExpenseManagement = () => {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyExpenseForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const isEditing = Boolean(form.id);

  const loadExpenses = async () => {
    try {
      const response = await fetch(`${API_URL}/expenses`, {
        headers: getAuthHeader(),
      });
      if (!response.ok) {
        throw new Error("Failed to load expenses");
      }
      const data = await response.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load expenses", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = !query
      ? expenses
      : expenses.filter((expense) =>
          expense.name?.toLowerCase().includes(query),
        );

    return [...list].sort(
      (a, b) => Number(b.id || 0) - Number(a.id || 0),
    );
  }, [expenses, searchTerm]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => setForm(emptyExpenseForm);

  const handleEdit = (expense) => {
    setForm({
      id: expense.id,
      name: expense.name || "",
      amount: expense.amount ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;

    try {
      const response = await fetch(`${API_URL}/expenses/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }
      setExpenses((prev) => prev.filter((expense) => expense.id !== id));
      if (form.id === id) {
        resetForm();
      }
    } catch (error) {
      console.error(error);
      window.alert("Could not delete expense.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      amount: form.amount,
    };

    try {
      const url = isEditing
        ? `${API_URL}/expenses/${form.id}`
        : `${API_URL}/expenses`;
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save expense");
      }

      const saved = await response.json();
      setExpenses((prev) => {
        if (isEditing) {
          return prev.map((expense) =>
            expense.id === saved.id ? saved : expense,
          );
        }
        return [saved, ...prev];
      });
      resetForm();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Could not save expense.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-expenses">
      <div>
        <h2 className="section-title">Expenses</h2>
        <p className="section-subtitle">Expense name and amount.</p>
      </div>

      <form onSubmit={handleSubmit} className="form" style={{ marginTop: "28px" }}>
        <div className="form__title">
          <h2>{isEditing ? "Edit expense" : "New expense"}</h2>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="button button--outline"
            >
              Cancel edit
            </button>
          )}
        </div>

        <label className="form__label">
          Expense name
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="form__input form__input--full"
            placeholder="e.g. Packaging, ads, delivery"
            required
          />
        </label>

        <label className="form__label">
          Amount
          <input
            type="number"
            min="0"
            step="1"
            value={form.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            className="form__input form__input--full"
            placeholder="5000"
            required
          />
        </label>

        <button
          type="submit"
          disabled={isSaving}
          className="button button--primary"
        >
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update expense"
              : "Add expense"}
        </button>
      </form>

      <div className="list" style={{ marginTop: "32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <h2>Expense entries</h2>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="form__input"
            placeholder="Search by name..."
            aria-label="Search expenses"
            style={{ minWidth: "220px" }}
          />
        </div>

        {isLoading ? (
          <div className="loading">Loading expenses...</div>
        ) : filteredExpenses.length ? (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="list-item">
              <div className="list-item__meta">
                <p style={{ fontWeight: 600 }}>{expense.name}</p>
                <p className="helper">Amount {formatMoney(expense.amount)}</p>
                {expense.createdAt && (
                  <p className="helper">
                    {new Date(expense.createdAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => handleEdit(expense)}
                  className="button button--outline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(expense.id)}
                  className="button button--outline button--danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="helper">No expenses yet. Add your first entry above.</p>
        )}
      </div>
    </div>
  );
};

export default AdminExpenseManagement;
