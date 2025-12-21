import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiPlus, FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { getAllBoxes, addBoxQuantity, subtractBoxQuantity } from "../../services/boxService";

const ITEMS_PER_PAGE = 18;

const normalizeQuantityMap = (quantityByColor) => {
  if (!quantityByColor) return {};
  if (quantityByColor instanceof Map) {
    const obj = {};
    quantityByColor.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return { ...quantityByColor };
};

const BoxesInventory = () => {
  const [boxes, setBoxes] = useState([]);
  const [filteredBoxes, setFilteredBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [qtyInputs, setQtyInputs] = useState({});
  const [colorInputs, setColorInputs] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(null); // boxId or null
  const [addFormData, setAddFormData] = useState({ quantity: "", color: "", note: "" });

  useEffect(() => {
    const loadBoxes = async () => {
      try {
        setLoading(true);
        const data = await getAllBoxes();
        const enhanced = data.map((box) => ({
          ...box,
          quantityByColor: normalizeQuantityMap(box.quantityByColor),
        }));
        setBoxes(enhanced);
        setFilteredBoxes(enhanced);
      } catch (error) {
        toast.error("Failed to load boxes");
      } finally {
        setLoading(false);
      }
    };
    loadBoxes();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredBoxes(boxes);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredBoxes(
        boxes.filter(
          (b) =>
            (b.title || "").toLowerCase().includes(q) ||
            (b.code || "").toLowerCase().includes(q) ||
            (b.category || "").toLowerCase().includes(q)
        )
      );
    }
    setCurrentPage(1);
  }, [searchQuery, boxes]);

  const totalPages = useMemo(
    () => Math.ceil(filteredBoxes.length / ITEMS_PER_PAGE),
    [filteredBoxes.length]
  );
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentBoxes = filteredBoxes.slice(startIndex, endIndex);

  const handleQtyChange = (boxId, value) => {
    setQtyInputs((prev) => ({ ...prev, [boxId]: value }));
  };

  const handleColorChange = (boxId, value) => {
    setColorInputs((prev) => ({ ...prev, [boxId]: value }));
  };

  const submitSubtract = async (box) => {
    const val = parseInt(qtyInputs[box._id], 10);
    const selectedColor = colorInputs[box._id]?.trim();

    if (!Number.isInteger(val) || val <= 0) {
      toast.error("Enter a valid positive quantity");
      return;
    }

    if (!selectedColor) {
      toast.error("Please select a color");
      return;
    }

    const quantityByColor = box.quantityByColor || {};
    const availableQty = quantityByColor[selectedColor] || 0;

    if (val > availableQty) {
      toast.error(
        `Requested quantity exceeds available stock for ${selectedColor}. Available: ${availableQty}`
      );
      return;
    }

    try {
      setSubmittingId(box._id);
      const res = await subtractBoxQuantity(box._id, {
        quantity: val,
        color: selectedColor,
      });
      const updatedQtyByColor = normalizeQuantityMap(
        res.box.quantityByColor || {}
      );
      setBoxes((prev) =>
        prev.map((b) =>
          b._id === box._id ? { ...b, quantityByColor: updatedQtyByColor } : b
        )
      );
      toast.success("Quantity subtracted");
      setQtyInputs((prev) => ({ ...prev, [box._id]: "" }));
      setColorInputs((prev) => ({ ...prev, [box._id]: "" }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to subtract quantity");
    } finally {
      setSubmittingId(null);
    }
  };

  const submitAdd = async (box) => {
    const val = parseInt(addFormData.quantity, 10);
    const selectedColor = addFormData.color?.trim();

    if (!Number.isInteger(val) || val <= 0) {
      toast.error("Enter a valid positive quantity");
      return;
    }

    if (!selectedColor) {
      toast.error("Please select a color");
      return;
    }

    try {
      setSubmittingId(box._id);
      const res = await addBoxQuantity(box._id, {
        quantity: val,
        color: selectedColor,
        note: addFormData.note || undefined,
      });
      const updatedQtyByColor = normalizeQuantityMap(
        res.box.quantityByColor || {}
      );
      setBoxes((prev) =>
        prev.map((b) =>
          b._id === box._id ? { ...b, quantityByColor: updatedQtyByColor } : b
        )
      );
      toast.success(`Added ${val} ${selectedColor} ${box.code} boxes`);
      setAddFormData({ quantity: "", color: "", note: "" });
      setShowAddModal(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add quantity");
    } finally {
      setSubmittingId(null);
    }
  };

  const skeletonRows = Array(3).fill(0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900">📦 Box Inventory</h1>
          <p className="mt-1 text-sm text-slate-600">Manage and track your inventory stock levels</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, code, or category..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
            />
          </div>
        </div>

        {/* Content Container */}
        <motion.div
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {skeletonRows.map((_, idx) => (
                <div
                  key={idx}
                  className="animate-pulse rounded-lg border border-slate-200 p-4 bg-slate-50"
                >
                  <div className="h-40 w-full bg-slate-300 rounded-lg mb-4"></div>
                  <div className="h-4 bg-slate-300 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-slate-300 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-slate-300 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : currentBoxes.length === 0 ? (
            <div className="text-center py-12 text-slate-600 font-medium">
              {searchQuery ? "🔍 No boxes found matching your search." : "📦 No boxes found."}
            </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentBoxes.map((box, index) => (
              <motion.div
                key={box._id}
                className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 relative group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                {/* Image Container */}
                <div className="relative overflow-hidden bg-slate-100 h-48">
                  <img src={box.image} alt={box.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <button
                    onClick={() =>
                      setExpandedId((prev) => (prev === box._id ? null : box._id))
                    }
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-700"
                  >
                    {expandedId === box._id ? "Close" : "View"}
                  </button>
                </div>

                <AnimatePresence>
                  {expandedId === box._id && (
                    <motion.div
                      key="expanded"
                      className="absolute inset-0 z-20"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                    >
                      <img src={box.image} alt={box.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                      <button
                        onClick={() => setExpandedId(null)}
                        className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold shadow-md"
                      >
                        Minimize
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Card Content */}
                <div className="p-5">
                  {/* Title and Category */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-2">{box.title}</h3>
                    <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                      {box.category || "other"}
                    </span>
                  </div>

                  {/* Product Info */}
                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-700">Code:</span>
                      <span className="font-mono text-slate-900 font-semibold">{box.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-700">Price:</span>
                      <span className="text-slate-900 font-semibold">₹{Number(box.price).toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-medium text-slate-700 block mb-2">Stock by Color:</span>
                      <div className="space-y-1.5">
                        {Array.isArray(box.colours) && box.colours.length > 0 ? (
                          box.colours.map((color) => {
                            const qty =
                              box.quantityByColor?.[color] ||
                              box.quantityByColor?.get?.(color) ||
                              0;
                            const outOfStock = qty === 0;
                            return (
                              <div key={color} className="flex justify-between items-center text-xs">
                                <span className="text-slate-600">{color}</span>
                                <span className={`font-semibold px-2 py-0.5 rounded ${outOfStock ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                  {qty} units
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-500 italic">No colors available</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold">Total Available:</span>{" "}
                      {typeof box.totalQuantity === "number" ? box.totalQuantity : 0}
                    </div>
                    <div>
                      <span className="font-semibold">Bag Size:</span> {box.bagSize}
                    </div>
                    <div>
                      <span className="font-semibold">Inner Size:</span> {box.boxInnerSize}
                    </div>
                    <div>
                      <span className="font-semibold">Outer Size:</span> {box.boxOuterSize}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-200 space-y-2">
                    <div className="flex flex-col gap-2">
                      {/* Color and Quantity Inputs */}
                      <div className="flex gap-2 items-center">
                        <select
                          value={colorInputs[box._id] ?? ""}
                          onChange={(e) => handleColorChange(box._id, e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select color</option>
                          {Array.isArray(box.colours) &&
                            box.colours.map((color) => (
                              <option key={color} value={color}>
                                {color} ({box.quantityByColor?.[color] || box.quantityByColor?.get?.(color) || 0})
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          placeholder="Qty"
                          value={qtyInputs[box._id] ?? ""}
                          onChange={(e) => handleQtyChange(box._id, e.target.value)}
                          className="w-14 px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      </div>
                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <motion.button
                          onClick={() => submitSubtract(box)}
                          disabled={submittingId === box._id}
                          className="flex-1 px-3 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          whileHover={{ scale: submittingId === box._id ? 1 : 1.02 }}
                          whileTap={{ scale: submittingId === box._id ? 1 : 0.98 }}
                        >
                          {submittingId === box._id ? "..." : "➖ Out"}
                        </motion.button>
                        <motion.button
                          onClick={() => setShowAddModal(box._id)}
                          disabled={submittingId === box._id}
                          className="flex-1 px-3 py-2.5 rounded-lg bg-green-600 text-white font-semibold text-xs hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          whileHover={{ scale: submittingId === box._id ? 1 : 1.02 }}
                          whileTap={{ scale: submittingId === box._id ? 1 : 0.98 }}
                        >
                          <FiPlus size={14} /> In
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredBoxes.length > 0 && totalPages > 1 && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mt-8 pt-6 border-t border-slate-200">
            <div className="text-sm text-slate-600 font-medium text-center lg:text-left">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredBoxes.length)} of {filteredBoxes.length} boxes
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <motion.button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
                whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
              >
                ← Previous
              </motion.button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                  )
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="text-slate-400">...</span>
                      )}
                      <motion.button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-all ${
                          currentPage === page
                            ? "bg-blue-600 text-white"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {page}
                      </motion.button>
                    </React.Fragment>
                  ))}
              </div>
              <motion.button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
                whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
              >
                Next →
              </motion.button>
            </div>
          </div>
        )}

        {/* Add Box Modal */}
        <AnimatePresence>
          {showAddModal && boxes.find((b) => b._id === showAddModal) && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(null)}
            >
              <motion.div
                className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm border border-slate-200"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Add Stock</h3>
                    <p className="text-sm text-slate-600 mt-1">Increase inventory for selected box</p>
                  </div>
                  <button
                    onClick={() => setShowAddModal(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg"
                  >
                    <FiX size={24} />
                  </button>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Color <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addFormData.color}
                      onChange={(e) => setAddFormData({ ...addFormData, color: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    >
                      <option value="">Select a color</option>
                      {Array.isArray(boxes.find((b) => b._id === showAddModal)?.colours) &&
                        boxes
                          .find((b) => b._id === showAddModal)
                          .colours.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={addFormData.quantity}
                      onChange={(e) => setAddFormData({ ...addFormData, quantity: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Remarks
                    </label>
                    <textarea
                      value={addFormData.note}
                      onChange={(e) => setAddFormData({ ...addFormData, note: e.target.value })}
                      placeholder="e.g. New stock received"
                      rows="3"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-6 border-t border-slate-200">
                    <motion.button
                      onClick={() => setShowAddModal(null)}
                      className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={() => submitAdd(boxes.find((b) => b._id === showAddModal))}
                      disabled={submittingId === showAddModal}
                      className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      whileHover={{ scale: submittingId === showAddModal ? 1 : 1.02 }}
                      whileTap={{ scale: submittingId === showAddModal ? 1 : 0.98 }}
                    >
                      {submittingId === showAddModal ? "Adding..." : "✓ Add Stock"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default BoxesInventory;

