"use client";

import React from "react";
import { motion } from "framer-motion";

export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "var(--clr-bg, #080c14)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        overflow: "hidden",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      {/* Background glow effects */}
      <motion.div
        style={{
          position: "absolute",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(138, 43, 226, 0.15) 0%, rgba(0,0,0,0) 70%)",
          zIndex: 1,
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        style={{
          position: "absolute",
          width: "40vw",
          height: "40vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, rgba(0,0,0,0) 70%)",
          zIndex: 1,
        }}
        animate={{ scale: [1.2, 1, 1.2], opacity: [1, 0.6, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Loader Animation */}
        <div style={{ position: "relative", width: "120px", height: "120px", marginBottom: "30px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid transparent",
              borderTopColor: "var(--clr-primary, #8a2be2)",
              borderRightColor: "#00d4ff",
              boxShadow: "0 0 20px rgba(138,43,226,0.4)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            style={{
              position: "absolute",
              top: "8px", left: "8px", right: "8px", bottom: "8px",
              borderRadius: "50%",
              border: "3px solid transparent",
              borderTopColor: "#00d4ff",
              borderLeftColor: "var(--clr-primary, #8a2be2)",
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />

          <motion.div
            style={{
              width: "35px",
              height: "35px",
              marginLeft: "6px",
              background: "linear-gradient(135deg, var(--clr-primary, #8a2be2), #00d4ff)",
              clipPath: "polygon(15% 0, 100% 50%, 15% 100%)",
            }}
            animate={{ scale: [0.9, 1.1, 0.9], filter: ["drop-shadow(0 0 5px rgba(0, 212, 255, 0.4))", "drop-shadow(0 0 15px rgba(0, 212, 255, 0.8))", "drop-shadow(0 0 5px rgba(0, 212, 255, 0.4))"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            margin: "0 0 10px",
            letterSpacing: "1px",
            background: "linear-gradient(to right, #ffffff, #b3b3b3)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent"
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          STREAM HUNTER
        </motion.h1>

        <motion.div
          style={{
            fontSize: "1.2rem",
            fontWeight: 500,
            color: "#b0b0b0",
            letterSpacing: "2px",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
        >
          جاري التحميل
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear", times: [0, 0.5, 1] }}
          >
            ...
          </motion.span>
        </motion.div>
      </div>

      {/* Film Grain overlay */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 20,
          opacity: 0.04,
          pointerEvents: "none",
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\\"0 0 200 200\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cfilter id=\\"noiseFilter\\"%3E%3CfeTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.65\\" numOctaves=\\"3\\" stitchTiles=\\"stitch\\"/%3E%3C/filter%3E%3Crect width=\\"100%25\\" height=\\"100%25\\" filter=\\"url(%23noiseFilter)\\"/%3E%3C/svg%3E")'
        }}
      ></div>
    </div>
  );
}
