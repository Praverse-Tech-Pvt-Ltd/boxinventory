import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

function AdminRoute({ children }) {
  const { user } = useSelector((state) => state.auth);

  if (user === null) return null; // Wait for profile fetch to finish

  return user && user.role === "admin" ? children : <Navigate to="/" replace />;
}

export default AdminRoute;
