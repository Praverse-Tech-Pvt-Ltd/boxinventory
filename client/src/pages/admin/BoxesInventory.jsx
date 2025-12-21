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
    <div className="space-y-6">
      <div className="relative">
        <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B5B4F]" size={20} />
        <input
          type="text"
          placeholder="Search by name, code, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] placeholder:text-[#8B7355] transition-all duration-300"
        />
      </div>

      <motion.div
        className="bg-white rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {skeletonRows.map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-2xl border-2 border-[#E8DCC6] p-4 bg-[#F9F7F4]"
              >
                <div className="h-40 w-full bg-[#E8DCC6] rounded-xl mb-4"></div>
                <div className="h-4 bg-[#E8DCC6] rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-[#E8DCC6] rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-[#E8DCC6] rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : currentBoxes.length === 0 ? (
          <div className="text-center py-12 text-[#2D1B0E] poppins font-medium">
            {searchQuery ? "No boxes found matching your search." : "No boxes found."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentBoxes.map((box, index) => (
              <motion.div
                key={box._id}
                className="rounded-2xl border-2 border-[#D4AF37]/30 bg-white overflow-hidden shadow-lg hover:shadow-xl transition-shadow relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <div className="relative group">
                  <img src={box.image} alt={box.title} className="w-full h-44 object-cover" />
                  <button
                    onClick={() =>
                      setExpandedId((prev) => (prev === box._id ? null : box._id))
                    }
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[#C1272D]/90 text-white text-xs font-semibold shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {expandedId === box._id ? "Minimize" : "Expand"}
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

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-lg font-semibold playfair text-[#C1272D]">{box.title}</h4>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#F4E4BC] text-[#2D1B0E]">
                      {box.category || "uncategorized"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-[#2D1B0E] poppins">
                    <div>
                      <span className="font-semibold">Code:</span>{" "}
                      <span className="font-mono">{box.code}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Price:</span> ₹
                      {Number(box.price).toFixed(2)}
                    </div>
                    <div>
                      <span className="font-semibold">Available by Color:</span>
                      <div className="ml-2 mt-1 space-y-1">
                        {Array.isArray(box.colours) && box.colours.length > 0 ? (
                          box.colours.map((color) => {
                            const qty =
                              box.quantityByColor?.[color] ||
                              box.quantityByColor?.get?.(color) ||
                              0;
                            return (
                              <div key={color} className="text-xs">
                                <span className="font-mono">{color}:</span>{" "}
                                <span className="font-semibold">{qty}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-500">No colors available</span>
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

                  <div className="mt-4 space-y-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <select
                          value={colorInputs[box._id] ?? ""}
                          onChange={(e) => handleColorChange(box._id, e.target.value)}
                          className="w-full sm:flex-1 px-2 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] text-xs"
                        >
                          <option value="">Color</option>
                          {Array.isArray(box.colours) &&
                            box.colours.map((color) => (
                              <option key={color} value={color}>
                                {color} (
                                {box.quantityByColor?.[color] ||
                                  box.quantityByColor?.get?.(color) ||
                                  0}
                                )
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
                          className="w-full sm:w-16 px-2 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E] text-xs"
                        />
                      </div>
                      <div className="flex gap-2 w-full">
                        <motion.button
                          onClick={() => submitSubtract(box)}
                          disabled={submittingId === box._id}
                          className="flex-1 px-2 py-2 rounded-lg bg-[#C1272D] text-white font-semibold text-xs hover:bg-[#A01F24] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          whileHover={{ scale: submittingId === box._id ? 1 : 1.05 }}
                          whileTap={{ scale: submittingId === box._id ? 1 : 0.95 }}
                        >
                          {submittingId === box._id ? "..." : "Subtract"}
                        </motion.button>
                        <motion.button
                          onClick={() => setShowAddModal(box._id)}
                          disabled={submittingId === box._id}
                          className="flex-1 px-2 py-2 rounded-lg bg-green-600 text-white font-semibold text-xs hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          whileHover={{ scale: submittingId === box._id ? 1 : 1.05 }}
                          whileTap={{ scale: submittingId === box._id ? 1 : 0.95 }}
                        >
                          <FiPlus size={14} /> Add
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mt-6 pt-6 border-t border-[#E8DCC6]">
            <div className="text-sm text-[#2D1B0E] poppins font-medium text-center lg:text-left">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredBoxes.length)} of{" "}
              {filteredBoxes.length} boxes
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <motion.button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border-2 border-[#D4AF37] text-[#2D1B0E] rounded-lg font-semibold poppins disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#D4AF37] hover:text-white transition-all duration-300"
                whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
                whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
              >
                Previous
              </motion.button>
              <div className="flex items-center gap-2">
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
                        <span className="text-[#6B5B4F]">...</span>
                      )}
                      <motion.button
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-lg font-semibold poppins transition-all duration-300 ${
                          currentPage === page
                            ? "bg-[#C1272D] text-white"
                            : "border-2 border-[#D4AF37] text-[#2D1B0E] hover:bg-[#D4AF37] hover:text-white"
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
                className="px-4 py-2 border-2 border-[#D4AF37] text-[#2D1B0E] rounded-lg font-semibold poppins disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#D4AF37] hover:text-white transition-all duration-300"
                whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
                whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
              >
                Next
              </motion.button>
            </div>
          </div>
        )}

        {/* Add Box Modal */}
        <AnimatePresence>
          {showAddModal && boxes.find((b) => b._id === showAddModal) && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(null)}
            >
              <motion.div
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border-2 border-[#D4AF37]/30"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold playfair text-[#C1272D]">Add Boxes</h3>
                  <button
                    onClick={() => setShowAddModal(null)}
                    className="text-[#6B5B4F] hover:text-[#2D1B0E] transition-colors"
                  >
                    <FiX size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-[#6B5B4F] mb-2">
                      Color
                    </label>
                    <select
                      value={addFormData.color}
                      onChange={(e) => setAddFormData({ ...addFormData, color: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E]"
                    >
                      <option value="">Select Color</option>
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
                    <label className="block text-xs font-semibold uppercase text-[#6B5B4F] mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={addFormData.quantity}
                      onChange={(e) => setAddFormData({ ...addFormData, quantity: e.target.value })}
                      placeholder="Enter quantity"
                      className="w-full px-4 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-[#6B5B4F] mb-2">
                      Remarks (Optional)
                    </label>
                    <textarea
                      value={addFormData.note}
                      onChange={(e) => setAddFormData({ ...addFormData, note: e.target.value })}
                      placeholder="e.g. New stock received from supplier"
                      rows="3"
                      className="w-full px-4 py-2 border-2 border-[#E8DCC6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] bg-white poppins text-[#2D1B0E]"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <motion.button
                      onClick={() => setShowAddModal(null)}
                      className="flex-1 px-4 py-2 border-2 border-[#D4AF37] text-[#2D1B0E] rounded-lg font-semibold hover:bg-[#F4E4BC] transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={() => submitAdd(boxes.find((b) => b._id === showAddModal))}
                      disabled={submittingId === showAddModal}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      whileHover={{ scale: submittingId === showAddModal ? 1 : 1.02 }}
                      whileTap={{ scale: submittingId === showAddModal ? 1 : 0.98 }}
                    >
                      {submittingId === showAddModal ? "Adding..." : "Add Boxes"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default BoxesInventory;

