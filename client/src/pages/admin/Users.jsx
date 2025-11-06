import React, { useEffect, useState } from "react";
import { getAllUsers, deleteUser as deleteUserAPI, updateUser as updateUserAPI } from "../../services/userService";
import { toast } from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";
import { FaRegEdit } from "react-icons/fa";
import { motion } from "framer-motion";

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
        isAdmin: formState.role === "admin",
      });
      setUsers((prev) => prev.map((u) => (u._id === id ? updated : u)));
      toast.success("🧘 User info updated");
      cancelEdit();
    } catch (error) {
      toast.error("❌ Update failed");
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
    <div className="min-h-screen bg-linear-to-br from-[#fef6f9] via-[#f4f7fe] to-[#f3fbf4] p-6 text-gray-700">
      <motion.h1
        className="text-4xl font-bold text-blue-600 mb-6 tracking-tight flex items-center gap-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🧑‍🤝‍🧑 Admin – User Management
      </motion.h1>

      <motion.div
        className="overflow-x-auto bg-white rounded-xl shadow-xl p-6 border border-gray-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <table className="min-w-full text-sm text-gray-700">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-purple-50 text-left rounded">
              <th className="px-4 py-3">🧍 Name</th>
              <th className="px-4 py-3">📧 Email</th>
              <th className="px-4 py-3">🔑 Role</th>
              <th className="px-4 py-3 text-center">⚙️ Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeletonRows.map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-5/6"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                  <td className="px-4 py-3 text-center"><div className="h-4 bg-gray-200 rounded w-12 mx-auto"></div></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-6 text-gray-500">No users found on this path.</td>
              </tr>
            ) : (
              users.map((u, index) => {
                const isEditing = editingId === u._id;
                return (
                  <motion.tr
                    key={u._id}
                    className="border-t hover:bg-blue-50"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <td className="p-3">
                      <input
                        name="name"
                        value={isEditing ? formState.name : u.name}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 rounded-md text-sm ${isEditing ? "border border-gray-300 bg-white focus:ring focus:ring-blue-200" : "bg-transparent border-none"}`}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        name="email"
                        value={isEditing ? formState.email : u.email}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 rounded-md text-sm ${isEditing ? "border border-gray-300 bg-white focus:ring focus:ring-blue-200" : "bg-transparent border-none"}`}
                      />
                    </td>
                    <td className="p-3">
                      <select
                        name="role"
                        value={isEditing ? formState.role : u.role}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 rounded-md text-sm ${isEditing ? "border border-gray-300 bg-white focus:ring focus:ring-blue-200" : "bg-transparent border-none"}`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-3 flex justify-center gap-3 text-lg">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(u._id)}
                            className="text-green-600 hover:text-green-800 transition"
                            title="Save"
                          >
                            💾
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-gray-500 hover:text-gray-800 transition"
                            title="Cancel"
                          >
                            ✖️
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(u)}
                            className="text-blue-600 hover:text-blue-800 transition"
                            title="Edit User"
                          >
                            <FaRegEdit size={18} />
                          </button>
                          <button
                            onClick={() => deleteUser(u._id)}
                            className="text-red-600 hover:text-red-800 transition"
                            title="Delete User"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Users;
