import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import Admin from "./pages/Admin.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import { isAuthed, subscribeToAuth } from "./utils/auth.js";

const App = () => {
  const [authed, setAuthed] = useState(isAuthed());
  const { pathname } = useLocation();
  const isProductDetail = /^\/products\/[^/]+$/.test(pathname);

  useEffect(() => subscribeToAuth(setAuthed), []);

  return (
    <div className={`page${isProductDetail ? " page--detail-soft" : ""}`}>
      <div className="page__texture" aria-hidden="true" />
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">SNEAKWAY</span>
            <span className="brand__divider" />
            <span className="brand__tag">shoe store</span>
          </Link>
        </div>
      </header>

      <main className="container section">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={authed ? <Admin /> : <Navigate to="/admin/login" />}
          />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <span className="site-footer__line" />
          Sneakway — curated sneakers for the street.
        </div>
      </footer>
    </div>
  );
};

export default App;
