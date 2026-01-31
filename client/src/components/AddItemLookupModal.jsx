import React, { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { searchBoxes } from "../services/challanService";

/**
 * AddItemLookupModal - Modal for searching and selecting a box to add as an item in Edit Challan
 * 
 * Features:
 * - Search boxes by code or title
 * - Display available colors and quantities
 * - Select a box and color to add as item
 * - Read-only product identity (code/name) after selection
 */
const AddItemLookupModal = ({ isOpen, onClose, onSelectBox }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [searchError, setSearchError] = useState("");
  const searchInputRef = React.useRef(null);

  // Debounced search
  const handleSearch = useCallback(
    async (query) => {
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        setSearchError("");
        return;
      }

      setIsSearching(true);
      setSearchError("");
      try {
        console.log("Searching for:", query);
        const results = await searchBoxes(query);
        console.log("Search results:", results);
        setSearchResults(results || []);
        if (!results || results.length === 0) {
          setSearchError("No products found matching your search");
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchError("Failed to search boxes: " + (error.message || "Unknown error"));
        toast.error("Failed to search boxes");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  // Debounce search input
  const debounceTimer = React.useRef(null);
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      handleSearch(query);
    }, 300);
  };

  // Handle selection of box
  const handleSelectBox = (box) => {
    setSelectedBoxId(box._id);
    setSelectedColor(null); // Reset color selection
  };

  // Handle selection of color
  const handleSelectColor = (color) => {
    setSelectedColor(color);
  };

  // Handle confirm selection
  const handleConfirm = () => {
    if (!selectedBoxId || !selectedColor) {
      toast.error("Please select a box and color");
      return;
    }

    const selectedBox = searchResults.find((b) => b._id === selectedBoxId);
    if (!selectedBox) {
      toast.error("Box not found");
      return;
    }

    // Create item data with boxId linked
    const newItem = {
      _id: Math.random().toString(),
      boxId: selectedBox._id,
      code: selectedBox.code,
      name: selectedBox.title,
      color: selectedColor,
      quantity: 0,
      rate: selectedBox.price || 0,
      assemblyCharge: 0,
      colors: selectedBox.colors, // Store available colors for dropdown
    };

    onSelectBox(newItem);

    // Reset and close
    setSearchQuery("");
    setSearchResults([]);
    setSelectedBoxId(null);
    setSelectedColor(null);
    onClose();
  };

  if (!isOpen) return null;

  // Auto-focus search input when modal opens
  React.useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const selectedBox = searchResults.find((b) => b._id === selectedBoxId);
  const availableColors = selectedBox?.colors || [];

  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Select Product for Item</h2>
          <button
            onClick={onClose}
            className="text-white text-2xl hover:opacity-80 transition"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Search Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Search by Code or Product Name
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchInput}
                placeholder="e.g., V22 or JMWER"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3 top-3 text-slate-400">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
            </div>
            {searchError && <p className="text-xs text-red-600 mt-1">{searchError}</p>}
          </div>

          {/* Two-Column Layout: Search Results + Selection Details */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Search Results */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Available Products</h3>
              <div className="border border-slate-300 rounded-lg overflow-y-auto max-h-64 bg-slate-50">
                {searchResults.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {searchResults.map((box) => (
                      <button
                        key={box._id}
                        onClick={() => handleSelectBox(box)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          selectedBoxId === box._id
                            ? "bg-blue-100 border-l-4 border-blue-500"
                            : "hover:bg-slate-100"
                        }`}
                      >
                        <div className="font-semibold text-slate-900">{box.code}</div>
                        <div className="text-sm text-slate-600">{box.title}</div>
                        <div className="text-xs text-slate-500">
                          Total Qty: {box.totalQuantity} | Price: ₹{box.price || 0}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchQuery && !isSearching ? (
                  <div className="px-4 py-8 text-center text-slate-500">
                    No products found
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-slate-500">
                    {searchQuery ? "Searching..." : "Enter search term above"}
                  </div>
                )}
              </div>
            </div>

            {/* Color Selection */}
            {selectedBox && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Color</h3>
                <div className="border border-slate-300 rounded-lg overflow-y-auto max-h-64 bg-slate-50">
                  {availableColors.length > 0 ? (
                    <div className="divide-y divide-slate-200">
                      {availableColors.map((colorItem) => (
                        <button
                          key={colorItem.color}
                          onClick={() => handleSelectColor(colorItem.color)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            selectedColor === colorItem.color
                              ? "bg-blue-100 border-l-4 border-blue-500"
                              : "hover:bg-slate-100"
                          }`}
                        >
                          <div className="font-semibold text-slate-900">{colorItem.color}</div>
                          <div className="text-xs text-slate-500">
                            Available: {colorItem.available} units
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-slate-500">
                      No colors available
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedBox && selectedColor && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Selected Item</h3>
              <div className="text-sm text-slate-700">
                <p><strong>Code:</strong> {selectedBox.code}</p>
                <p><strong>Product:</strong> {selectedBox.title}</p>
                <p><strong>Color:</strong> {selectedColor}</p>
                <p><strong>Unit Price:</strong> ₹{selectedBox.price || 0}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedBoxId || !selectedColor}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Item
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AddItemLookupModal;
