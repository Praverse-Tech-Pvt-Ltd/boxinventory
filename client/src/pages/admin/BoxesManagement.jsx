import React, { useEffect, useState } from "react";
import {
  getAllBoxes,
  createBox,
  updateBox,
  deleteBox,
} from "../../services/boxService";
import { toast } from "react-hot-toast";
import "../../styles/dashboard.css";
import { FiTrash2, FiCheck, FiPlus, FiX, FiSearch } from "react-icons/fi";
import { FaRegEdit } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmDialog from "../../components/ConfirmDialog";

const ITEMS_PER_PAGE = 20;

const BoxesManagement = () => {
  const [boxes, setBoxes] = useState([]);
  const [filteredBoxes, setFilteredBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const [formData, setFormData] = useState({
    image: null,
    imagePreview: "",
    title: "",
    code: "",
    category: "",
    price: "",
    bagSize: "",
    boxInnerSize: "",
    boxOuterSize: "",
    colours: "",
    quantityByColor: {}, // { color: quantity }
  });

  // Delete confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { id, title }

  const formatDimensionValue = (input) => {
    if (!input) return "";
  
    // Convert to string and clean whitespace
    let value = String(input).trim();
    if (!value) return "";
  
    // Replace x, X, * with ' X ' and normalize spaces
    value = value.replace(/[xX*]/g, " X ").replace(/\s+/g, " ").trim();
  
    // Ensure consistent ' inch' suffix (no duplicates)
    if (/inch$/i.test(value)) {
      return value.replace(/\s*inch$/i, " inch"); // normalize spacing before inch
    }
  
    return `${value} inch`;
  };
  
  const handleDimensionBlur = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: formatDimensionValue(prev[field]),
    }));
  };
  

  useEffect(() => {
    loadBoxes();
  }, []);

  useEffect(() => {
    // Filter boxes based on search query
    if (searchQuery.trim() === "") {
      setFilteredBoxes(boxes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = boxes.filter(
        (box) =>
          box.title.toLowerCase().includes(query) ||
          box.code.toLowerCase().includes(query) ||
          (box.category || "").toLowerCase().includes(query)
      );
      setFilteredBoxes(filtered);
    }
    setCurrentPage(1); // Reset to first page on search
  }, [searchQuery, boxes]);

  const loadBoxes = async () => {
    try {
      setLoading(true);
      const data = await getAllBoxes();
      setBoxes(data);
      setFilteredBoxes(data);
    } catch (error) {
      toast.error("Failed to fetch boxes");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
        imagePreview: URL.createObjectURL(file),
      }));
    }
  };

  const getInitialFormData = () => ({
    image: null,
    imagePreview: "",
    title: "",
    code: "",
    category: "",
    price: "",
      bagSize: "",
      boxInnerSize: "",
      boxOuterSize: "",
    colours: "",
    quantityByColor: { "": 0 }, // Start with one empty pair
  });

  const resetForm = () => {
    setFormData(getInitialFormData());
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (box) => {
    // Convert quantityByColor Map to object if needed
    let quantityByColorObj = {};
    if (box.quantityByColor) {
      if (box.quantityByColor instanceof Map) {
        box.quantityByColor.forEach((value, key) => {
          quantityByColorObj[key] = value;
        });
      } else if (typeof box.quantityByColor === 'object') {
        quantityByColorObj = { ...box.quantityByColor };
      }
    }
    
    // If no quantityByColor exists but colours do, initialize with 0 quantities
    if (Object.keys(quantityByColorObj).length === 0 && Array.isArray(box.colours) && box.colours.length > 0) {
      box.colours.forEach(color => {
        quantityByColorObj[color] = 0;
      });
    }
    
    setEditingId(box._id);
    setFormData({
      image: null,
      imagePreview: box.image || "",
      title: box.title || "",
      code: box.code || "",
      category: box.category || "",
      price: box.price?.toString() || "",
      bagSize: formatDimensionValue(box.bagSize || ""),
      boxInnerSize: formatDimensionValue(box.boxInnerSize || ""),
      boxOuterSize: formatDimensionValue(box.boxOuterSize || ""),
      colours: Object.keys(quantityByColorObj).join(", "),
      quantityByColor: quantityByColorObj,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      const formattedBagSize = formatDimensionValue(formData.bagSize);
      const formattedBoxInnerSize = formatDimensionValue(formData.boxInnerSize);
      const formattedBoxOuterSize = formatDimensionValue(formData.boxOuterSize);
      
      if (formData.image) {
        formDataToSend.append("image", formData.image);
      }

      formDataToSend.append("title", formData.title);
      formDataToSend.append("code", formData.code);
      formDataToSend.append("category", formData.category);
      formDataToSend.append("price", formData.price);
      formDataToSend.append("bagSize", formattedBagSize);
      formDataToSend.append("boxInnerSize", formattedBoxInnerSize);
      formDataToSend.append("boxOuterSize", formattedBoxOuterSize);
      // Extract colours from quantityByColor keys
      const coloursArray = Object.keys(formData.quantityByColor).filter(c => c.trim().length > 0);
      formDataToSend.append("colours", coloursArray.join(", "));
      formDataToSend.append("quantityByColor", JSON.stringify(formData.quantityByColor));

      if (editingId) {
        // Update existing box
        if (formData.image) {
          await updateBox(editingId, formDataToSend);
        } else {
          // Update without image - send as JSON
          // Extract colours from quantityByColor keys
          const coloursArray = Object.keys(formData.quantityByColor).filter(c => c.trim().length > 0);
          const jsonData = {
            title: formData.title,
            code: formData.code,
            category: formData.category,
            price: parseFloat(formData.price),
            bagSize: formattedBagSize,
            boxInnerSize: formattedBoxInnerSize,
            boxOuterSize: formattedBoxOuterSize,
            colours: coloursArray.join(", "),
            quantityByColor: formData.quantityByColor,
          };
          await updateBox(editingId, jsonData);
        }
        toast.success("Box updated successfully");
      } else {
        // Create new box
        await createBox(formDataToSend);
        toast.success("Box created successfully");
      }

      resetForm();
      loadBoxes();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to save box"
      );
    }
  };

  const handleDelete = async (id, title) => {
    setPendingDelete({ id, title });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteBox(pendingDelete.id);
      toast.success("Box deleted successfully");
      setConfirmOpen(false);
      setPendingDelete(null);
      loadBoxes();
    } catch (error) {
      toast.error("Failed to delete box");
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredBoxes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentBoxes = filteredBoxes.slice(startIndex, endIndex);

  const skeletonRows = Array(3).fill(0);

  return (
    <div className="w-full section-spacing">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="section-title">📦 Boxes Management</h2>
        <p className="section-subtitle">Create, edit and manage box products</p>
      </div>

      {/* Main Card */}
      <motion.div
        className="dashboard-card hover-lift"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Card Header & Add Box Button */}
        <div className="card-header mb-6">
          <h3 className="card-header-title">Box Products</h3>
          <motion.button
            onClick={() => {
              if (showForm && !editingId) {
                resetForm();
              } else if (editingId) {
                resetForm();
              } else {
                setEditingId(null);
                setFormData(getInitialFormData());
                setShowForm(true);
              }
            }}
            className="btn btn-success btn-sm"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {showForm && !editingId ? (
              <>
                <FiX size={16} />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <FiPlus size={16} />
                <span>{editingId ? "Cancel Edit" : "Add New Box"}</span>
              </>
            )}
          </motion.button>
        </div>
        {editingId && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm text-red-600 font-semibold mb-4 px-6"
          >
            ✎ Editing mode - modify details below
          </motion.div>
        )}

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="dashboard-card mb-6"
          >
            <h3 className="card-header-title mb-6">
              {editingId ? "Edit Box" : "Add New Box"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Image Upload */}
                <div className="md:col-span-2">
                  <label className="form-label">
                    Product Image (Optional)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="dropzone"
                    />
                    {formData.imagePreview && (
                      <img
                        src={formData.imagePreview}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-lg border-2 border-red-300"
                      />
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="form-group">
                  <label className="form-label">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="form-input"
                    placeholder="Luxury Gift Box"
                  />
                </div>

                {/* Code */}
                <div className="form-group">
                  <label className="form-label">
                    Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    className="form-input uppercase"
                    placeholder="BOX001"
                  />
                </div>

                {/* Category */}
                <div className="form-group">
                  <label className="form-label">
                    Category (Optional)
                  </label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="lotus-pink series"
                  />
                </div>

                {/* Price */}
                <div className="form-group">
                  <label className="form-label">
                    Price *
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="100.00"
                  />
                </div>

                {/* Bag Size */}
                <div className="form-group">
                  <label className="form-label">
                    Bag Size (Optional)
                  </label>
                  <input
                    type="text"
                    name="bagSize"
                    value={formData.bagSize}
                    onChange={handleChange}
                    onBlur={() => handleDimensionBlur("bagSize")}
                    className="form-input"
                    placeholder="6 x 5 x 1.75 inch"
                  />
                </div>

                {/* Box Inner Size */}
                <div className="form-group">
                  <label className="form-label">
                    Box Inner Size (Optional)
                  </label>
                  <input
                    type="text"
                    name="boxInnerSize"
                    value={formData.boxInnerSize}
                    onChange={handleChange}
                    onBlur={() => handleDimensionBlur("boxInnerSize")}
                    className="form-input"
                    placeholder="4 x 4 x 1.5 inch"
                  />
                </div>

                {/* Box Outer Size */}
                <div className="form-group">
                  <label className="form-label">
                    Box Outer Size (Optional)
                  </label>
                  <input
                    type="text"
                    name="boxOuterSize"
                    value={formData.boxOuterSize}
                    onChange={handleChange}
                    onBlur={() => handleDimensionBlur("boxOuterSize")}
                    className="form-input"
                    placeholder="4.74 x 4.75 x 1.5 inch"
                  />
                </div>

                {/* Color-Quantity Pairs */}
                <div className="md:col-span-2">
                  <label className="form-label">
                    Color-Quantity Pairs *
                  </label>
                  <div className="space-y-3">
                    {Object.entries(formData.quantityByColor).map(([color, qty], index) => (
                      <div key={index} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={color}
                          onChange={(e) => {
                            const newColor = e.target.value.trim();
                            const updatedQtyByColor = { ...formData.quantityByColor };
                            delete updatedQtyByColor[color];
                            if (newColor) {
                              updatedQtyByColor[newColor] = qty;
                            }
                            setFormData(prev => ({
                              ...prev,
                              quantityByColor: updatedQtyByColor,
                              colours: Object.keys(updatedQtyByColor).join(", ")
                            }));
                          }}
                          placeholder="Color name"
                          className="w-40 form-input"
                        />
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value, 10) || 0;
                            setFormData(prev => ({
                              ...prev,
                              quantityByColor: {
                                ...prev.quantityByColor,
                                [color]: newQty
                              }
                            }));
                          }}
                          placeholder="Quantity"
                          className="flex-1 form-input"
                        />
                        <motion.button
                          type="button"
                          onClick={() => {
                            const updatedQtyByColor = { ...formData.quantityByColor };
                            delete updatedQtyByColor[color];
                            setFormData(prev => ({
                              ...prev,
                              quantityByColor: updatedQtyByColor,
                              colours: Object.keys(updatedQtyByColor).join(", ")
                            }));
                          }}
                          className="btn btn-danger btn-sm"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <FiTrash2 size={16} />
                          Remove
                        </motion.button>
                      </div>
                    ))}
                    <motion.button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          quantityByColor: {
                            ...prev.quantityByColor,
                            "": 0
                          }
                        }));
                      }}
                      className="w-full btn btn-secondary"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FiPlus size={16} />
                      Add Color-Quantity Pair
                    </motion.button>
                  </div>
                  <p className="mt-2 text-xs text-theme-text-muted">
                    Add color-quantity pairs. At least one pair with quantity &gt; 0 is required.
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <motion.button
                    type="submit"
                    className="flex-1 btn btn-success"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FiCheck size={16} />
                    <span>
                      {editingId ? "Update Box" : "Create Box"}
                    </span>
                  </motion.button>
                  {editingId && (
                    <motion.button
                      type="button"
                      onClick={resetForm}
                      className="px-6 btn btn-secondary"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FiX size={16} />
                      Cancel
                    </motion.button>
                  )}
                </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="relative mb-6">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input pl-12"
        />
      </div>

      {/* Boxes Grid */}
      <div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {skeletonRows.map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-2xl border-2 border-theme-border p-4 bg-theme-surface-2">
                <div className="h-40 w-full bg-theme-surface-hover rounded-xl mb-4"></div>
                <div className="h-4 bg-theme-surface-hover rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-theme-surface-hover rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-theme-surface-hover rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : currentBoxes.length === 0 ? (
          <div className="text-center py-12 text-theme-text-primary poppins font-medium">
            {searchQuery ? "No boxes found matching your search." : "No boxes found."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentBoxes.map((box, index) => (
              <motion.div
                key={box._id}
                className="rounded-2xl border-2 border-theme-accent/30 bg-theme-surface overflow-hidden shadow-lg hover:shadow-xl transition-shadow relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                {/* Image */}
                <div className="relative group">
                  <img
                    src={box.image}
                    alt={box.title}
                    className="w-full h-44 object-cover"
                  />
                  <button
                    onClick={() => setExpandedId((prev) => (prev === box._id ? null : box._id))}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-theme-primary/90 text-white text-xs font-semibold shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title={expandedId === box._id ? "Minimize" : "Expand"}
                  >
                    {expandedId === box._id ? "Minimize" : "Expand"}
                  </button>
                </div>

                {/* Expanded overlay inside card */}
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
                      <img
                        src={box.image}
                        alt={box.title}
                        className="w-full h-full object-cover"
                      />
                      {/* gradient for readability of controls */}
                      <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/40 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
                      <button
                        onClick={() => setExpandedId(null)}
                        className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold shadow-md"
                        title="Minimize image"
                        aria-label="Minimize image"
                      >
                        Minimize
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Details */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-lg font-semibold playfair text-theme-primary">{box.title}</h4>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-theme-accent/10 text-theme-accent-dark">
                      {box.category || "uncategorized"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-theme-text-primary poppins">
                    <div><span className="font-semibold">Code:</span> <span className="font-mono">{box.code}</span></div>
                    <div><span className="font-semibold">Price:</span> ₹{box.price?.toFixed(2)}</div>
                    <div>
                      <span className="font-semibold">Total Quantity:</span>{" "}
                      {typeof box.totalQuantity === "number" ? box.totalQuantity : 0}
                    </div>
                    <div><span className="font-semibold">Quantity by Color:</span>
                      <div className="ml-2 mt-1 space-y-1">
                        {Array.isArray(box.colours) && box.colours.length > 0 ? (
                          box.colours.map(color => {
                            const qty = box.quantityByColor?.[color] || box.quantityByColor?.get?.(color) || 0
                            return (
                              <div key={color} className="text-xs">
                                <span className="font-mono">{color}:</span> <span className="font-semibold">{qty}</span>
                              </div>
                            )
                          })
                        ) : (
                          <span className="text-xs text-theme-text-muted">No colors available</span>
                        )}
                      </div>
                    </div>
                    <div><span className="font-semibold">Bag Size:</span> {box.bagSize}</div>
                    <div><span className="font-semibold">Inner Size:</span> {box.boxInnerSize}</div>
                    <div><span className="font-semibold">Outer Size:</span> {box.boxOuterSize}</div>
                    <div><span className="font-semibold">Colours:</span> {Array.isArray(box.colours) && box.colours.length ? box.colours.join(", ") : "N/A"}</div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-3">
                    <motion.button
                      onClick={() => startEdit(box)}
                      className="btn btn-warning btn-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FaRegEdit size={14} />
                      Edit
                    </motion.button>
                    <motion.button
                      onClick={() => handleDelete(box._id, box.title)}
                      className="btn btn-danger btn-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FiTrash2 size={14} />
                      Delete
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredBoxes.length > 0 && totalPages > 1 && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mt-6 pt-6 border-t border-theme-border">
            <div className="text-sm text-theme-text-secondary text-center lg:text-left">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredBoxes.length)} of{" "}
              {filteredBoxes.length} boxes
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <motion.button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary btn-sm disabled:opacity-50"
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
                        <span className="text-theme-text-muted">...</span>
                      )}
                      <motion.button
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                          currentPage === page
                            ? "btn btn-primary"
                            : "btn btn-secondary"
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
                className="btn btn-secondary btn-sm disabled:opacity-50"
                whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
                whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
              >
                Next
              </motion.button>
            </div>
          </div>
        )}
      </div>

      </motion.div>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this box?"
        description={pendingDelete ? `Are you sure you want to delete "${pendingDelete.title}"? This action cannot be undone.` : ""}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDelete(null);
        }}
      />
    </div>
  );
};

export default BoxesManagement;

