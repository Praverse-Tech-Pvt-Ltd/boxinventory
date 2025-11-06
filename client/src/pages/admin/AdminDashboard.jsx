import React from "react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const goToUsers = () => {
    navigate("/admin/users");
  };

  return (
    <div style={{ textAlign: "center", marginTop: "40px" }}>
      <h1>Admin Dashboard</h1>
      <button
        onClick={goToUsers}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          fontSize: "16px",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        View All Users
      </button>
    </div>
  );
};

export default AdminDashboard;
