import React, { useEffect, useState } from "react";
import {
  getAllBoxes,
  createBox,
  updateBox,
  deleteBox,
} from "../../services/boxService";
import { toast } from "react-hot-toast";
import { FiTrash2, FiCheck, FiPlus, FiX, FiSearch } from "react-icons/fi";
import { FaRegEdit } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

const ITEMS_PER_PAGE = 20;

const BoxesManagement = () => {
  const [boxes, setBoxes] = useState([]);
  const [filteredBoxes, setFilteredBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

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
    quantity: "",
    colours: "",
  });

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
    quantity: "",
    colours: "",
  });

  const resetForm = () => {
    setFormData(getInitialFormData());
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (box) => {
    setEditingId(box._id);
    setFormData({
      image: null,
      imagePreview: box.image || "",
      title: box.title || "",
      code: box.code || "",
      category: box.category || "",
      price: box.price?.toString() || "",
      bagSize: box.bagSize || "",
      boxInnerSize: box.boxInnerSize || "",
      boxOuterSize: box.boxOuterSize || "",
      quantity: box.quantity?.toString() || "",
      colours: Array.isArray(box.colours) ? box.colours.join(", ") : (box.colours || ""),
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      
      if (formData.image) {
        formDataToSend.append("image", formData.image);
      } else if (!editingId && !formData.imagePreview) {
        toast.error("Image is required");
        return;
      }

      formDataToSend.append("title", formData.title);
      formDataToSend.append("code", formData.code);
      formDataToSend.append("category", formData.category);
      formDataToSend.append("price", formData.price);
      formDataToSend.append("bagSize", formData.bagSize);
      formDataToSend.append("boxInnerSize", formData.boxInnerSize);
      formDataToSend.append("boxOuterSize", formData.boxOuterSize);
      formDataToSend.append("quantity", formData.quantity);
      formDataToSend.append("colours", formData.colours);

      if (editingId) {
        // Update existing box
        if (formData.image) {
          await updateBox(editingId, formDataToSend);
        } else {
          // Update without image - send as JSON
          const jsonData = {
            title: formData.title,
            code: formData.code,
            category: formData.category,
            price: parseFloat(formData.price),
            bagSize: formData.bagSize,
            boxInnerSize: formData.boxInnerSize,
            boxOuterSize: formData.boxOuterSize,
            quantity: parseInt(formData.quantity),
            colours: formData.colours,
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
    if (
      window.confirm(
        `Are you sure you want to delete "${title}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteBox(id);
        toast.success("Box deleted successfully");
        loadBoxes();
      } catch (error) {
        toast.error("Failed to delete box");
      }
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredBoxes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentBoxes = filteredBoxes.slice(startIndex, endIndex);

  const skeletonRows = Array(3).fill(0);

  return (
    <div className="w-full space-y-6">
      {/* Add Box Button */}
      <div className="flex justify-between items-center">
        <motion.button
          onClick={() => {
            if (showForm && !editingId) {
              // Form is open and not editing - close it
              resetForm();
            } else if (editingId) {
              // Currently editing - cancel edit
              resetForm();
            } else {
              // Form is closed - open it for new box
              setEditingId(null);
              setFormData(getInitialFormData());
              setShowForm(true);
            }
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#C1272D] via-[#A01F24] to-[#C1272D] text-white rounded-xl font-semibold poppins shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent"
            initial={{ x: "-100%" }}
            whileHover={{ x: "100%" }}
            transition={{ duration: 0.6 }}
          />
          {showForm && !editingId ? (
            <>
              <FiX className="relative z-10" size={20} />
              <span className="relative z-10">Cancel</span>
            </>
          ) : (
            <>
              <FiPlus className="relative z-10" size={20} />
              <span className="relative z-10">
                {editingId ? "Cancel Edit" : "Add New Box"}
              </span>
            </>
          )}
        </motion.button>

        {editingId && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm text-[#C1272D] font-semibold poppins"
          >
            Editing Box
          </motion.div>
        )}
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-[#F5F1E8] via-white to-[#F4E4BC]/30 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            <h3 className="text-2xl font-bold playfair text-[#C1272D] mb-6">
              {editingId ? "Edit Box" : "Add New Box"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Image Upload */}
                <div className="md:col-span-2">
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Product Image {!editingId && "*"}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-sm text-[#5D3A00] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#D4AF37] file:text-[#5D3A00] hover:file:bg-[#C1272D] hover:file:text-white cursor-pointer"
                    />
                    {formData.imagePreview && (
                      <img
                        src={formData.imagePreview}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-lg border-2 border-[#D4AF37]/30"
                      />
                    )}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="Luxury Gift Box"
                  />
                </div>

                {/* Code */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300 uppercase"
                    placeholder="BOX001"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Category *
                  </label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="lotus-pink series"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
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
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="100.00"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="100"
                  />
                </div>

                {/* Bag Size */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Bag Size *
                  </label>
                  <input
                    type="text"
                    name="bagSize"
                    value={formData.bagSize}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="6 x 5 x 1.75 inch"
                  />
                </div>

                {/* Box Inner Size */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Box Inner Size *
                  </label>
                  <input
                    type="text"
                    name="boxInnerSize"
                    value={formData.boxInnerSize}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="4 x 4 x 1.5 inch"
                  />
                </div>

                {/* Box Outer Size */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Box Outer Size *
                  </label>
                  <input
                    type="text"
                    name="boxOuterSize"
                    value={formData.boxOuterSize}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="4.74 x 4.75 x 1.5 inch"
                  />
                </div>

                {/* Colours */}
                <div className="md:col-span-2">
                  <label className="block mb-2 text-sm font-semibold text-[#5D3A00] poppins">
                    Colours * (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="colours"
                    value={formData.colours}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
                    placeholder="Red, Gold, Pink, Blue"
                  />
                  <p className="mt-1 text-xs text-[#5D3A00]/60 poppins">
                    Enter colours separated by commas (e.g., Red, Gold, Pink)
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-4">
                <motion.button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#C1272D] via-[#A01F24] to-[#C1272D] text-white py-3 rounded-xl font-semibold poppins shadow-lg hover:shadow-xl relative overflow-hidden group transition-all duration-300"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6 }}
                  />
                  <span className="relative z-10">
                    {editingId ? "Update Box" : "Create Box"}
                  </span>
                </motion.button>
                {editingId && (
                  <motion.button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border-2 border-[#C1272D] text-[#C1272D] rounded-xl font-semibold poppins hover:bg-[#C1272D] hover:text-white transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="relative">
        <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#5D3A00]/50" size={20} />
        <input
          type="text"
          placeholder="Search by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border-2 border-[#E8DCC6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] bg-white/80 poppins text-[#5D3A00] placeholder:text-[#A0826D]/50 transition-all duration-300"
        />
      </div>

      {/* Boxes Grid */}
      <motion.div
        className="bg-gradient-to-br from-[#F5F1E8] via-white to-[#F4E4BC]/30 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-[#D4AF37]/30 p-6 md:p-8 relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {skeletonRows.map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-2xl border-2 border-[#E8DCC6] p-4 bg-white/60">
                <div className="h-40 w-full bg-[#E8DCC6]/50 rounded-xl mb-4"></div>
                <div className="h-4 bg-[#E8DCC6]/50 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-[#E8DCC6]/50 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-[#E8DCC6]/50 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : currentBoxes.length === 0 ? (
          <div className="text-center py-12 text-[#5D3A00]/60 poppins">
            {searchQuery ? "No boxes found matching your search." : "No boxes found."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentBoxes.map((box, index) => (
              <motion.div
                key={box._id}
                className="rounded-2xl border-2 border-[#D4AF37]/30 bg-white/70 overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
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
                    onClick={() => window.open(box.image, '_blank')}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[#C1272D]/90 text-white text-xs font-semibold shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Open full image"
                  >
                    Expand
                  </button>
                </div>

                {/* Details */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-lg font-semibold playfair text-[#C1272D]">{box.title}</h4>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#F4E4BC] text-[#5D3A00]">
                      {box.category || "uncategorized"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-[#5D3A00] poppins">
                    <div><span className="font-semibold">Code:</span> <span className="font-mono">{box.code}</span></div>
                    <div><span className="font-semibold">Price:</span> ₹{box.price?.toFixed(2)}</div>
                    <div><span className="font-semibold">Quantity:</span> {box.quantity || 0}</div>
                    <div><span className="font-semibold">Bag Size:</span> {box.bagSize}</div>
                    <div><span className="font-semibold">Inner Size:</span> {box.boxInnerSize}</div>
                    <div><span className="font-semibold">Outer Size:</span> {box.boxOuterSize}</div>
                    <div><span className="font-semibold">Colours:</span> {Array.isArray(box.colours) && box.colours.length ? box.colours.join(", ") : "N/A"}</div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex justify-end gap-3">
                    <motion.button
                      onClick={() => startEdit(box)}
                      className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#5D3A00] font-semibold hover:bg-[#C1272D] hover:text-white transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Edit
                    </motion.button>
                    <motion.button
                      onClick={() => handleDelete(box._id, box.title)}
                      className="px-4 py-2 rounded-lg bg-[#C1272D] text-white font-semibold hover:bg-[#A01F24] transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
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
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#E8DCC6]/50">
            <div className="text-sm text-[#5D3A00]/70 poppins">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredBoxes.length)} of{" "}
              {filteredBoxes.length} boxes
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border-2 border-[#D4AF37] text-[#5D3A00] rounded-lg font-semibold poppins disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#D4AF37] hover:text-white transition-all duration-300"
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
                        <span className="text-[#5D3A00]/50">...</span>
                      )}
                      <motion.button
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-lg font-semibold poppins transition-all duration-300 ${
                          currentPage === page
                            ? "bg-[#C1272D] text-white"
                            : "border-2 border-[#D4AF37] text-[#5D3A00] hover:bg-[#D4AF37] hover:text-white"
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
                className="px-4 py-2 border-2 border-[#D4AF37] text-[#5D3A00] rounded-lg font-semibold poppins disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#D4AF37] hover:text-white transition-all duration-300"
                whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
                whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
              >
                Next
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default BoxesManagement;

