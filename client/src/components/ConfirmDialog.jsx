import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.92, y: 10 },
};

const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={overlayVariants}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onCancel}
          />
          <motion.div
            className="relative z-[101] w-[92%] max-w-md bg-gradient-to-br from-[#F5F1E8] via-white to-[#F4E4BC]/40 border-2 border-[#D4AF37]/40 rounded-2xl shadow-2xl overflow-hidden"
            variants={dialogVariants}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            <div className="p-6">
              <h4 id="confirm-dialog-title" className="text-xl font-bold playfair text-[#C1272D]">
                {title}
              </h4>
              {description && (
                <p className="mt-2 text-sm text-[#5D3A00]/80 poppins">{description}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <motion.button
                  onClick={onCancel}
                  className="px-4 py-2 border-2 border-[#C1272D] text-[#C1272D] rounded-lg font-semibold poppins hover:bg-[#C1272D] hover:text-white transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {cancelText}
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-lg bg-[#C1272D] text-white font-semibold poppins shadow-md hover:bg-[#A01F24] transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {confirmText}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;


