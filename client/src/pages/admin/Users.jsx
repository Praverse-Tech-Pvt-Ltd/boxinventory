import React, { useEffect, useState } from "react";
import { getAllUsers, deleteUser as deleteUserAPI, updateUser as updateUserAPI } from "../../services/userService";
import { toast } from "react-hot-toast";
import { FiTrash2, FiCheck } from "react-icons/fi";
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
    <div className="w-full">
      <motion.div
        className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-4 sm:p-6 md:p-8 relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Gold shimmer overlay on card */}
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#D4AF37] to-transparent rounded-t-3xl" />
        <div className="overflow-x-auto">
        <table className="min-w-full text-xs sm:text-sm poppins">
          <thead>
            <tr className="bg-[#F4E4BC] text-left rounded-t-xl border-b-2 border-[#D4AF37]/30">
              <th className="px-4 py-4 font-semibold text-[#2D1B0E] poppins">Name</th>
              <th className="px-4 py-4 font-semibold text-[#2D1B0E] poppins">Email</th>
              <th className="px-4 py-4 font-semibold text-[#2D1B0E] poppins">Role</th>
              <th className="px-4 py-4 font-semibold text-[#2D1B0E] poppins text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeletonRows.map((_, idx) => (
                <tr key={idx} className="animate-pulse border-b border-[#E8DCC6]">
                  <td className="px-4 py-4"><div className="h-4 bg-[#E8DCC6] rounded w-3/4"></div></td>
                  <td className="px-4 py-4"><div className="h-4 bg-[#E8DCC6] rounded w-5/6"></div></td>
                  <td className="px-4 py-4"><div className="h-4 bg-[#E8DCC6] rounded w-1/2"></div></td>
                  <td className="px-4 py-4 text-center"><div className="h-4 bg-[#E8DCC6] rounded w-12 mx-auto"></div></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-12 text-[#2D1B0E] poppins font-medium">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u, index) => {
                const isEditing = editingId === u._id;
                return (
                  <motion.tr
                    key={u._id}
                    className="border-b border-[#E8DCC6] hover:bg-[#F9F7F4] transition-colors duration-200"
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
                        className={`w-full px-3 py-2 rounded-lg text-sm poppins text-[#2D1B0E] ${
                          isEditing
                            ? "border-2 border-[#D4AF37]/50 bg-white focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
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
                        className={`w-full px-3 py-2 rounded-lg text-sm poppins text-[#2D1B0E] ${
                          isEditing
                            ? "border-2 border-[#D4AF37]/50 bg-white focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
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
                        className={`w-full px-3 py-2 rounded-lg text-sm poppins text-[#2D1B0E] ${
                          isEditing
                            ? "border-2 border-[#D4AF37]/50 bg-white focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
                            : "bg-transparent border-none"
                        }`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-3 flex-wrap">
                        {isEditing ? (
                          <>
                            <motion.button
                              onClick={() => saveEdit(u._id)}
                              className="text-[#D4AF37] hover:text-[#C1272D] transition-colors duration-200"
                              title="Save"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <FiCheck size={20} />
                            </motion.button>
                            <motion.button
                              onClick={cancelEdit}
                              className="text-[#6B5B4F] hover:text-[#C1272D] transition-colors duration-200"
                              title="Cancel"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              ✖️
                            </motion.button>
                          </>
                        ) : (
                          <>
                            <motion.button
                              onClick={() => startEdit(u)}
                              className="text-[#D4AF37] hover:text-[#C1272D] transition-colors duration-200"
                              title="Edit User"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <FaRegEdit size={20} />
                            </motion.button>
                            <motion.button
                              onClick={() => deleteUser(u._id)}
                              className="text-[#C1272D] hover:text-[#A01F24] transition-colors duration-200"
                              title="Delete User"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <FiTrash2 size={20} />
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
      </motion.div>
    </div>
  );
};

export default Users;
