"use client";

import { motion } from "framer-motion";

export default function Preloader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <motion.div
          className="mb-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="mx-auto mb-4 h-16 w-16 rounded-full border-4 border-slate-200 border-t-blue-600"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>
        <motion.p
          className="text-lg font-semibold text-slate-700"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Initializing ONNX Inference Engine...
        </motion.p>
        <motion.p
          className="mt-2 text-sm text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Loading machine learning models
        </motion.p>
      </div>
    </div>
  );
}

