import React, { useEffect, useState } from "react";
import { getAllUsers, deleteUser as deleteUserAPI, updateUser as updateUserAPI } from "../../services/userService";
import { toast } from "react-hot-toast";
import { FiTrash2, FiCheck } from "react-icons/fi";
import { FaRegEdit } from "react-icons/fa";
import { motion } from "framer-motion";
import "../../styles/dashboard.css";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState({ name: "", email: "", role: "user" });
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const startEdit = (user) => {
    setEditingId(user._id);
    setFormState({ name: user.name, email: user.email, role: user.role });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormState({ name: "", email: "", role: "user" });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (id) => {
    try {
      const updated = await updateUserAPI(id, {
        name: formState.name,
        email: formState.email,
        role: formState.role,
      });
      // Ensure the updated user has all required fields
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ...updated } : u)));
      toast.success("🧘 User info updated");
      cancelEdit();
    } catch (error) {
      console.error("Update error:", error);
      toast.error(error.response?.data?.message || "❌ Update failed");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to remove this soul from the system?")) return;
    try {
      await deleteUserAPI(id);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      toast.success("🕊️ User removed");
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const skeletonRows = Array(3).fill(0);

  return (
    <div className="w-full section-spacing">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="section-title">👥 Users Management</h2>
        <p className="section-subtitle">Manage system users and assign roles</p>
      </div>

      {/* Main Card */}
      <motion.div
        className="dashboard-card hover-lift"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Card Header with Toolbar */}
        <div className="card-header">
          <h3 className="card-header-title">Users List</h3>
          <span className="text-theme-text-muted">{users.length} total users</span>
        </div>

        {/* Table */}
        <div className="card-body">
          <div className="table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  skeletonRows.map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td><div className="h-4 bg-gray-300 dark:bg-slate-600 rounded w-3/4"></div></td>
                      <td><div className="h-4 bg-gray-300 dark:bg-slate-600 rounded w-5/6"></div></td>
                      <td><div className="h-4 bg-gray-300 dark:bg-slate-600 rounded w-1/2"></div></td>
                      <td className="text-right"><div className="h-4 bg-gray-300 dark:bg-slate-600 rounded w-12 ml-auto"></div></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-theme-text-muted font-medium">
                      No users found.
                    </td>
                  </tr>
                ) : (
              users.map((u, index) => {
                const isEditing = editingId === u._id;
                return (
                  <motion.tr
                    key={u._id}
                    className="border-b border-theme-border hover:bg-theme-row-hover transition-colors duration-200"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <td className="p-4">
                      <input
                        name="name"
                        value={isEditing ? formState.name : u.name}
                        onChange={handleChange}
                        disabled={!isEditing}
                        autoComplete="name"
                        className={`w-full px-3 py-2 rounded-lg text-sm poppins text-theme-text-primary ${
                          isEditing
                            ? "border-2 border-theme-primary/50 bg-theme-input-bg focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary"
                            : "bg-transparent border-none"
                        }`}
                      />
                    </td>
                    <td className="p-4">
                      <input
                        name="email"
                        value={isEditing ? formState.email : u.email}
                        onChange={handleChange}
                        disabled={!isEditing}
                        autoComplete="email"
                        className={`w-full px-3 py-2 rounded-lg text-sm poppins text-theme-text-primary ${
                          isEditing
                            ? "border-2 border-theme-primary/50 bg-theme-input-bg focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary"
                            : "bg-transparent border-none"
                        }`}
                      />
                    </td>
                    <td className="p-4">
                      <select
                        name="role"
                        value={isEditing ? formState.role : u.role}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 rounded-lg text-sm poppins text-theme-text-primary ${
                          isEditing
                            ? "border-2 border-theme-primary/50 bg-theme-input-bg focus:ring-2 focus:ring-theme-primary/30 focus:border-theme-primary"
                            : "bg-transparent border-none"
                        }`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <div className="actions flex-wrap justify-end gap-2 sm:gap-3">
                        {isEditing ? (
                          <>
                            <motion.button
                              onClick={() => saveEdit(u._id)}
                              className="btn btn-success btn-sm"
                              title="Save changes"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <FiCheck size={16} />
                              Save
                            </motion.button>
                            <motion.button
                              onClick={cancelEdit}
                              className="btn btn-secondary btn-sm"
                              title="Cancel editing"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Cancel
                            </motion.button>
                          </>
                        ) : (
                          <>
                            <motion.button
                              onClick={() => startEdit(u)}
                              className="btn btn-warning btn-sm"
                              title="Edit user"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <FaRegEdit size={14} />
                            </motion.button>
                            <motion.button
                              onClick={() => deleteUser(u._id)}
                              className="btn btn-danger btn-sm"
                              title="Delete user"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <FiTrash2 size={14} />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Users;

