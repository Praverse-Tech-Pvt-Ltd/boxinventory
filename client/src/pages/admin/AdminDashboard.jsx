import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../redux/authSlice";
import { logoutUser } from "../../services/authService";
import { motion, AnimatePresence } from "framer-motion";
import { FiLogOut, FiUsers, FiBox, FiFileText, FiLayers } from "react-icons/fi";
import Users from "./Users";
import BoxesManagement from "./BoxesManagement";
import AuditHistory from "./AuditHistory";
import ChallanGeneration from "./ChallanGeneration";
import BoxesInventory from "./BoxesInventory";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("users");

  const handleLogout = async () => {
    try {
      await logoutUser();
      dispatch(logout());
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const tabs = [
    { id: "users", label: "Users Management", icon: FiUsers },
    { id: "boxes", label: "Boxes Management", icon: FiBox },
    { id: "inventory", label: "Boxes Inventory", icon: FiLayers },
    { id: "audits", label: "Audit History", icon: FiFileText },
    { id: "challan", label: "Challan Generation", icon: FiFileText },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#C1272D] via-[#A01F24] to-[#8B1A1F] poppins relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-[#D4AF37]/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-[#F4C2C2]/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Gold accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-30" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-30" />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-white border-b-2 border-[#D4AF37]/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center sm:text-left"
          >
            <h1 className="text-3xl md:text-4xl font-bold playfair text-[#C1272D]">
              Admin Dashboard
            </h1>
            <p className="text-sm text-[#2D1B0E] poppins mt-1 font-medium">
              Xclusive Folding Boxes Management
            </p>
          </motion.div>

          <motion.button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#C1272D] via-[#A01F24] to-[#C1272D] text-white rounded-xl font-semibold poppins shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group w-full sm:w-auto"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent"
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.6 }}
            />
            <FiLogOut className="relative z-10" size={18} />
            <span className="relative z-10">Logout</span>
          </motion.button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="relative z-10 max-w-7xl mx-auto px-0 sm:px-6 pt-6 bg-white">
        <div className="flex gap-2 sm:gap-4 border-b-2 border-[#D4AF37]/30 overflow-x-auto scrollbar-thin scrollbar-thumb-[#D4AF37]/50 scrollbar-track-transparent px-4 sm:px-0 pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative whitespace-nowrap px-4 sm:px-6 py-3 sm:py-4 font-semibold poppins transition-all duration-300 flex items-center gap-2 ${
                  isActive
                    ? "text-[#C1272D]"
                    : "text-[#2D1B0E] hover:text-[#C1272D]"
                }`}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon size={20} />
                <span className="text-sm sm:text-base">{tab.label}</span>
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] to-[#F4E4BC] rounded-t-full"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Users />
            </motion.div>
          )}

          {activeTab === "boxes" && (
            <motion.div
              key="boxes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <BoxesManagement />
            </motion.div>
          )}

          {activeTab === "inventory" && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <BoxesInventory />
            </motion.div>
          )}

          {activeTab === "audits" && (
            <motion.div
              key="audits"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <AuditHistory />
            </motion.div>
          )}

          {activeTab === "challan" && (
            <motion.div
              key="challan"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ChallanGeneration />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminDashboard;
