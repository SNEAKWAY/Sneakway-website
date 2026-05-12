import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthed, setAuthToken } from "../utils/auth.js";

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthed()) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!ADMIN_TOKEN) {
      setError("Admin token is not configured.");
      return;
    }
    if (password.trim() !== ADMIN_TOKEN) {
      setError("Invalid access code.");
      return;
    }

    setAuthToken(ADMIN_TOKEN);
    navigate("/admin");
  };

  return (
    <section className="section" style={{ maxWidth: "520px" }}>
      <div>
        <p className="eyebrow">Studio access</p>
        <h1 className="section-title">Sign in</h1>
        <p className="section-subtitle">
          Enter the access code to manage the Sneakway catalog.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form" style={{ marginTop: "24px" }}>
        <label className="form__label">
          Access code
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            className="form__input"
            placeholder="••••••••"
            required
          />
        </label>
        {error && <p className="helper helper--error">{error}</p>}
        <button type="submit" className="button button--primary">
          Enter admin
        </button>
      </form>
    </section>
  );
};

export default AdminLogin;

