import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials } from "./redux/authSlice";
import { getProfile } from "./services/authService";
import {
  useNavigate,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Users from "./pages/admin/Users";
import Home from "./pages/Home";
import AdminRoute from "./protection/AdminRoute";
import ProtectedRoute from "./protection/ProtectedRoute";

const AppContent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = await getProfile();
        dispatch(setCredentials({ user }));

        // Redirect only if we're at a neutral route (login/register/root)
        if (
          location.pathname === "/" ||
          location.pathname === "/login" ||
          location.pathname === "/register"
        ) {
          if (user.role === "admin") {
            navigate("/admin/admindashboard", { replace: true });
          } else {
            navigate("/home", { replace: true });
          }
        }
      } catch (error) {
        console.log("Not logged in or session expired");
      }
    };
    fetchProfile();
  }, [dispatch, navigate]);

  return (
    <Routes>
      {/* Default redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected user route */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/admindashboard"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <Users />
          </AdminRoute>
        }
      />

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppContent;
