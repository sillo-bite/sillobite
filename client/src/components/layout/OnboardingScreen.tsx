import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Lottie from "lottie-react";
import { useTheme } from "@/contexts/ThemeContext";

const favoritebitesAnimation = "/lottiefiles/favoritebites.json";
const deliveryAppAnimation = "/lottiefiles/Food.json";
const foodAnimation = "/lottiefiles/Beagle Fast Food.json";
const CafeAnimation = "/lottiefiles/Cafe.json";

const slides = [
  {
    id: 1,
    title: "Choose your vibe",
    description: "Discover your favorite Stall and order your favorite Bite.",
    animation: CafeAnimation,
  },
  {
    id: 2,
    title: "Favourite Bites",
    description: "Discover your favorite bites get it ready in minutes.",
    animation: favoritebitesAnimation,
  },
  {
    id: 3,
    title: "Explore Menu",
    description: "Discover a wide range of dishes from your Favorite Stores.",
    animation: deliveryAppAnimation,
  },
  {
    id: 4,
    title: "Get Started",
    description: "Order your favorite food and get hussle free dining experience.",
    animation: foodAnimation,
  },
];

export default function OnboardingScreen() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [animationData, setAnimationData] = useState<any>(null);
  const { resolvedTheme } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(slides[currentSlide].animation)
      .then((res) => res.json())
      .then((data) => {
        setAnimationData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load animation:", err);
        setLoading(false);
      });
  }, [currentSlide]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleGetStarted();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleGetStarted = () => {
    localStorage.setItem("onboarding_completed", "true");
    sessionStorage.setItem("fromOnboarding", "true");
    setLocation("/login");
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_completed", "true");
    setLocation("/login");
  };

  return (
    <div className={`flex flex-col items-center justify-center relative overflow-hidden h-[100dvh] ${resolvedTheme === 'dark' ? 'bg-background' : 'bg-background'}`}>

      {/* Skip Button */}
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={handleSkip}
          className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-full hover:bg-[#ff7a55] transition-colors"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md px-4">
        {/* Lottie Animation Section */}
        <div className="w-full h-64 sm:h-80 flex items-center justify-center mb-8">
          {!loading && animationData ? (
            <Lottie
              animationData={animationData}
              loop={true}
              className="w-full h-full"
              renderer={"svg" as any}
            />
          ) : (
            <div className="w-48 h-48 bg-gray-100 rounded-full animate-pulse" />
          )}
        </div>

        {/* Content Carousel */}
        <div className="w-full h-32 relative flex items-start justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col items-center text-center"
            >
              <h1
                className={`text-3xl font-black tracking-tight mb-4 ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                style={{ fontFamily: "Lobster, cursive" }}
              >
                {slides[currentSlide].title}
              </h1>

              <p className={`text-sm leading-relaxed max-w-[260px] ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {slides[currentSlide].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination Dots */}
        <div className="flex space-x-2 my-8">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-colors duration-300 ${index === currentSlide ? "bg-primary" : "bg-gray-200"
                }`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between w-full max-w-[200px] mt-4">
          {/* Prev Button - Ghost style to de-emphasize */}

          {currentSlide > 0 && (
            <div className="w-[7ch] flex justify-center">
              <button
                onClick={handlePrev}
                className="text-gray-500 hover:text-primary font-bold px-4 py-2 transition-colors flex items-center"
              >
                Prev
              </button>
            </div>
          )}


          {/* Next Button */}
          <div className={`flex bg-primary items-center rounded-full ${currentSlide > 0 ? "ml-4" : "ml-14"}`}>
            <button
              onClick={handleNext}
              className="flex items-center text-white text-md font-bold ml-4 py-1.5 w-[7ch] rounded-full transition-colors"
            >
              {currentSlide === slides.length - 1 ? "Start" : "Next"}
              <ArrowRight className="ml-2 text-white" />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
