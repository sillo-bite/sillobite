"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import Wave1 from "./svg/wave1"
const loopWords = ["University", "Hospital", "Corporate", "Industry"]

export const HeroSection = () => {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(v => (v + 1) % loopWords.length), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="relative min-h-[60vh] bg-[#FFFBF7] overflow-hidden flex flex-col justify-center ">

      {/* Background blobs */}

      <div className="container mx-auto px-4 lg:mt-16 relative z-10">

        {/* TEXT */}
        <div className="text-center max-w-4xl mx-auto mb-[5vh]">

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:text-6xl text-3xl font-bold text-gray-700 leading-tight mb-6"
          >
            Streamline{" "}
            <span className="relative inline-flex items-center justify-center bg-[#9847D1] text-white px-4 h-[1.1em] lg:w-[8ch] w-[9ch]  lg:rounded-xl rounded-md align-middle overflow-hidden whitespace-nowrap">

              <AnimatePresence mode="wait">
                <motion.span
                  key={loopWords[idx]}
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="absolute"
                >
                  {loopWords[idx]}
                </motion.span>
              </AnimatePresence>

            </span>
            <br />
            Dining with SilloBite.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-2xl text-gray-600 max-w-3xl mx-auto"
          >
            A complete multi-vendor management platform for modern cafeterias.
          </motion.p>
        </div>

        {/* IMAGE */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative max-w-5xl mx-auto mt-[5vh]"
        >
          <div className="flex justify-center">
            <img
              src="/dashboard.png"
              alt="Dashboard"
              className="w-[90%] sm:w-[80%] lg:w-full max-w-5xl h-auto object-contain"
            />
          </div>
        </motion.div>

      </div>

      {/* Wave */}
      <div className="absolute bottom-0 left-0 w-full leading-none z-20">
        <Wave1 color="#9847D1" style={{ transform: 'scaleY(-1)' }} />
      </div>


    </section>
  )
}


