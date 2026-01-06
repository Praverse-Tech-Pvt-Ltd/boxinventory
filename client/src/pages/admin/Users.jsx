import React, { useEffect, useState } from "react";
import { getAllUsers, deleteUser as deleteUserAPI, updateUser as updateUserAPI, changeUserPassword } from "../../services/userService";
import { toast } from "react-hot-toast";
import { FiTrash2, FiCheck, FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { FaRegEdit, FaLock } from "react-icons/fa";
import { motion } from "framer-motion";
import "../../styles/dashboard.css";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState({ name: "", email: "", role: "user" });
  const [loading, setLoading] = useState(true);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState({ new: false, confirm: false });
  const [changingPassword, setChangingPassword] = useState(false);

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

  const openPasswordModal = (user) => {
    setPasswordModalUser(user);
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setShowPassword({ new: false, confirm: false });
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordModalUser(null);
    setPasswordForm({ newPassword: "", confirmPassword: "" });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitPasswordChange = async () => {
    if (!passwordForm.newPassword) {
      toast.error("New password is required");
      return;
    }
    if (!passwordForm.confirmPassword) {
      toast.error("Confirm password is required");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      setChangingPassword(true);
      await changeUserPassword(passwordModalUser._id, {
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      toast.success("✅ Password changed successfully");
      closePasswordModal();
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
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
                              onClick={() => openPasswordModal(u)}
                              className="btn btn-info btn-sm"
                              title="Change password"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <FaLock size={14} />
                            </motion.button>
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

      {/* Password Change Modal */}
      {passwordModalOpen && passwordModalUser && (
        <motion.div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-8 border border-theme-border dark:border-slate-700"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-theme-text-primary dark:text-white flex items-center gap-2">
                <FaLock /> Change Password
              </h2>
              <button
                onClick={closePasswordModal}
                className="text-theme-text-muted hover:text-theme-text-primary dark:text-slate-400 dark:hover:text-white transition-colors p-1 hover:bg-theme-surface-2 dark:hover:bg-slate-700 rounded"
              >
                <FiX size={20} />
              </button>
            </div>

            <p className="text-sm text-theme-text-secondary dark:text-slate-300 mb-6 bg-theme-surface-2 dark:bg-slate-700 p-3 rounded-lg">
              User: <span className="font-semibold text-theme-text-primary dark:text-white">{passwordModalUser.email}</span>
            </p>

            <div className="space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-theme-text-primary dark:text-white mb-2">
                  New Password (min 8 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword.new ? "text" : "password"}
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 border-2 border-theme-input-border rounded-lg bg-theme-input-bg text-theme-text-primary placeholder-theme-text-muted focus:outline-none focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/30 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-3.5 text-theme-text-muted hover:text-theme-text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {showPassword.new ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-theme-text-primary dark:text-white mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword.confirm ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 border-2 border-theme-input-border rounded-lg bg-theme-input-bg text-theme-text-primary placeholder-theme-text-muted focus:outline-none focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/30 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-3.5 text-theme-text-muted hover:text-theme-text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {showPassword.confirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-theme-border dark:border-slate-700">
              <motion.button
                onClick={closePasswordModal}
                disabled={changingPassword}
                className="flex-1 px-4 py-3 border-2 border-theme-border text-theme-text-primary dark:text-white dark:border-slate-600 rounded-lg font-semibold hover:bg-theme-surface-2 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={submitPasswordChange}
                disabled={changingPassword}
                className="flex-1 px-4 py-3 bg-theme-primary text-white rounded-lg font-semibold hover:bg-theme-primary-dark transition-colors disabled:opacity-60"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {changingPassword ? "..." : "Change Password"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Users;