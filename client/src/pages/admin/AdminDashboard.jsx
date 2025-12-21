import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../redux/authSlice";
import { logoutUser } from "../../services/authService";
import { motion, AnimatePresence } from "framer-motion";
import { FiLogOut, FiUsers, FiBox, FiFileText, FiLayers } from "react-icons/fi";
import "../../styles/dashboard.css";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 relative overflow-hidden">
      {/* Premium Multi-Layer Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100/80" />
        
        {/* Soft radial gradients for depth - positioned strategically */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-red-200/10 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-slate-300/10 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-indigo-200/8 rounded-full blur-3xl" />
        </div>

        {/* Animated subtle accent - single, elegant element */}
        <motion.div
          className="absolute top-1/4 left-1/3 w-96 h-96 bg-gradient-to-br from-blue-300/8 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.3, 0.15],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-gradient-to-tl from-slate-400/6 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1.1, 0.85, 1.1],
            opacity: [0.1, 0.25, 0.1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Elegant grid pattern - very subtle texture */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" stroke="%23000000" stroke-width="0.5"%3E%3Cpath d="M0 0h80M0 20h80M0 40h80M0 60h80M0 80h80M0 0v80M20 0v80M40 0v80M60 0v80M80 0v80"/%3E%3C/g%3E%3C/svg%3E")'
          }}
        />

        {/* Premium accent lines - top and subtle */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-300/30 to-transparent" />
        <div className="absolute top-1 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-200/15 to-transparent" />
        
        {/* Subtle vignette effect */}
        <div className="absolute inset-0 bg-radial-gradient(circle at center, transparent 0%, rgba(203, 213, 225, 0.02) 100%)" />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-gradient-to-r from-white via-blue-50/40 to-white border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-4 sm:gap-6 sm:flex-row sm:items-center sm:justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center sm:text-left flex-1"
          >
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Vishal Paper Product
            </h1>
            <p className="text-sm md:text-base text-slate-600 mt-2 font-medium tracking-wide">
              Box Inventory & Challan Management System
            </p>
          </motion.div>

          <motion.button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group w-full sm:w-auto"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
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
      <div className="relative z-10 max-w-7xl mx-auto px-0 sm:px-6 pt-8 sm:pt-10 bg-transparent">
        <div className="flex gap-1 sm:gap-2 border-b border-slate-200/50 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent px-4 sm:px-0 pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative whitespace-nowrap px-4 sm:px-5 py-3 sm:py-4 font-semibold transition-all duration-300 flex items-center gap-2 rounded-t-lg text-sm sm:text-base ${
                  isActive
                    ? 'bg-gradient-to-b from-red-600/95 to-red-700 text-white shadow-md border-b-2 border-red-600'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60 border-b-2 border-transparent'
                }`}
                whileHover={{ y: isActive ? 0 : -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-300/50 via-blue-200 to-blue-300/50 rounded-full"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tab Content - Premium Card Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Content wrapper with premium padding and visual anchors */}
          <div className="relative p-6 sm:p-8 md:p-10">
            {/* Subtle top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
            
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
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
