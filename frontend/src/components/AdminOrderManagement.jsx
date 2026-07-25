import { useEffect, useMemo, useState } from "react";
import { getAuthHeader } from "../utils/auth.js";
import { formatMoney } from "../utils/adminFinance.js";
import {
  normalizeOrderType,
  ORDER_TYPES,
  sendRetailBillOnWhatsApp,
} from "../utils/orderBilling.js";

const API_URL = import.meta.env.VITE_API_URL;

const emptyOrderForm = {
  id: null,
  customerName: "",
  customerPhone: "",
  trackingId: "",
  customerPrice: "",
  profit: "",
  orderType: ORDER_TYPES.retail,
};

const AdminOrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyOrderForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [billingId, setBillingId] = useState(null);

  const isEditing = Boolean(form.id);
  const isRetailForm = form.orderType === ORDER_TYPES.retail;

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/orders`, {
        headers: getAuthHeader(),
      });
      if (!response.ok) {
        throw new Error("Failed to load orders");
      }
      const data = await response.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load orders", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = !query
      ? orders
      : orders.filter((order) => {
          const name = order.customerName?.toLowerCase() || "";
          const tracking = order.trackingId?.toLowerCase() || "";
          const phone = order.customerPhone?.toLowerCase() || "";
          const type = normalizeOrderType(order.orderType);
          return (
            name.includes(query) ||
            tracking.includes(query) ||
            phone.includes(query) ||
            type.includes(query)
          );
        });

    return [...list].sort(
      (a, b) => Number(b.id || 0) - Number(a.id || 0),
    );
  }, [orders, searchTerm]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => setForm(emptyOrderForm);

  const handleEdit = (order) => {
    setForm({
      id: order.id,
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      trackingId: order.trackingId || "",
      customerPrice: order.customerPrice ?? "",
      profit: order.profit ?? "",
      orderType: normalizeOrderType(order.orderType),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this order?")) return;

    try {
      const response = await fetch(`${API_URL}/orders/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (!response.ok) {
        throw new Error("Failed to delete order");
      }
      setOrders((prev) => prev.filter((order) => order.id !== id));
      if (form.id === id) {
        resetForm();
      }
    } catch (error) {
      console.error(error);
      window.alert("Could not delete order.");
    }
  };

  const handleBillWhatsApp = async (order) => {
    setBillingId(order.id);
    try {
      await sendRetailBillOnWhatsApp(order);
    } catch (error) {
      window.alert(error.message || "Could not open WhatsApp bill.");
    } finally {
      setBillingId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      trackingId: form.trackingId.trim(),
      customerPrice: form.customerPrice,
      profit: form.profit,
      orderType: form.orderType,
    };

    try {
      const url = isEditing
        ? `${API_URL}/orders/${form.id}`
        : `${API_URL}/orders`;
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
        throw new Error(body.message || "Failed to save order");
      }

      const saved = await response.json();
      setOrders((prev) => {
        if (isEditing) {
          return prev.map((order) =>
            order.id === saved.id ? saved : order,
          );
        }
        return [saved, ...prev];
      });
      resetForm();
    } catch (error) {
      console.error(error);
      window.alert(error.message || "Could not save order.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-orders">
      <div>
        <h2 className="section-title">Orders</h2>
        <p className="section-subtitle">
          Retail or reselling. Retail orders can generate a PDF bill and open
          WhatsApp for the customer.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form" style={{ marginTop: "28px" }}>
        <div className="form__title">
          <h2>{isEditing ? "Edit order" : "New order"}</h2>
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
          Order type
          <select
            value={form.orderType}
            onChange={(event) => updateField("orderType", event.target.value)}
            className="form__input form__input--full form__select"
          >
            <option value={ORDER_TYPES.retail}>Retail</option>
            <option value={ORDER_TYPES.reselling}>Reselling</option>
          </select>
        </label>

        <label className="form__label">
          Customer name
          <input
            type="text"
            value={form.customerName}
            onChange={(event) =>
              updateField("customerName", event.target.value)
            }
            className="form__input form__input--full"
            placeholder="Customer name"
            required
          />
        </label>

        <label className="form__label">
          Customer phone
          <input
            type="tel"
            value={form.customerPhone}
            onChange={(event) =>
              updateField("customerPhone", event.target.value)
            }
            className="form__input form__input--full"
            placeholder={
              isRetailForm
                ? "WhatsApp number for bill (e.g. 9876543210)"
                : "Optional phone"
            }
            required={isRetailForm}
          />
        </label>

        <label className="form__label">
          Tracking ID
          <input
            type="text"
            value={form.trackingId}
            onChange={(event) => updateField("trackingId", event.target.value)}
            className="form__input form__input--full"
            placeholder="Optional — add later if needed"
          />
        </label>

        <div className="form__row">
          <label className="form__label">
            Customer price
            <input
              type="number"
              min="0"
              step="1"
              value={form.customerPrice}
              onChange={(event) =>
                updateField("customerPrice", event.target.value)
              }
              className="form__input form__input--full"
              placeholder="9999"
              required
            />
          </label>
          <label className="form__label">
            Profit
            <input
              type="number"
              step="1"
              value={form.profit}
              onChange={(event) => updateField("profit", event.target.value)}
              className="form__input form__input--full"
              placeholder="2500"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="button button--primary"
        >
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update order"
              : "Add order"}
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
          <h2>Order entries</h2>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="form__input"
            placeholder="Search name, phone, tracking, type..."
            aria-label="Search orders"
            style={{ minWidth: "220px" }}
          />
        </div>

        {isLoading ? (
          <div className="loading">Loading orders...</div>
        ) : filteredOrders.length ? (
          filteredOrders.map((order) => {
            const type = normalizeOrderType(order.orderType);
            const isRetail = type === ORDER_TYPES.retail;
            return (
              <div key={order.id} className="list-item order-list-item">
                <div className="list-item__meta">
                  <p style={{ fontWeight: 600 }}>{order.customerName}</p>
                  <p className="helper">
                    <span className={`order-type-badge order-type-badge--${type}`}>
                      {type === ORDER_TYPES.reselling ? "Reselling" : "Retail"}
                    </span>
                    {order.customerPhone
                      ? ` · ${order.customerPhone}`
                      : " · No phone"}
                  </p>
                  <p className="helper">
                    {order.trackingId
                      ? `Tracking ${order.trackingId}`
                      : "No tracking ID yet"}
                  </p>
                  <p className="helper">
                    Price {formatMoney(order.customerPrice)} · Profit{" "}
                    {formatMoney(order.profit)}
                  </p>
                  {order.createdAt && (
                    <p className="helper">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </p>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  {isRetail && (
                    <button
                      type="button"
                      onClick={() => handleBillWhatsApp(order)}
                      className="button button--primary"
                      disabled={billingId === order.id}
                    >
                      {billingId === order.id
                        ? "Opening..."
                        : "Bill + WhatsApp"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEdit(order)}
                    className="button button--outline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(order.id)}
                    className="button button--outline button--danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="helper">No orders yet. Add your first entry above.</p>
        )}
      </div>
    </div>
  );
};

export default AdminOrderManagement;
