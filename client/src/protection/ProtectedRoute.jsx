// src/protection/ProtectedRoute.jsx
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const { user } = useSelector((state) => state.auth);
  if (user === null) return null; // wait for profile fetch
  return user ? children : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
