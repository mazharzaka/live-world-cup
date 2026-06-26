'use client';

import { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('🔍 جاري الاتصال بالسيرفر الخلفي...');
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Check if we've already shown the splash screen in this session
    const hasShown = sessionStorage.getItem('hasShownSplash');
    if (hasShown) {
      setShouldRender(false);
      return;
    }
    setShouldRender(true);
  }, []);

  useEffect(() => {
    if (!shouldRender) return;

    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 25); // ~2.5s total loading speed for seamless feel

    return () => clearInterval(interval);
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    // Update Arabic status text based on progress
    if (progress < 25) {
      setStatusText('🔍 جاري الاتصال بخادم ستريم هنتر...');
    } else if (progress < 55) {
      setStatusText('📡 فحص حالة خوادم البث المباشر...');
    } else if (progress < 80) {
      setStatusText('⚡ تهيئة مشغل الفيديو الذكي وتجاوز الحماية...');
    } else {
      setStatusText('🎯 تم التثبيت بنجاح! جاهز للاصطياد.');
    }

    if (progress === 100) {
      // Trigger fade-out animation
      const fadeTimeout = setTimeout(() => {
        setIsVisible(false);
        sessionStorage.setItem('hasShownSplash', 'true');
      }, 400);
      return () => clearTimeout(fadeTimeout);
    }
  }, [progress, shouldRender]);

  // Completely unmount the splash overlay after fade-out transition completes (600ms)
  useEffect(() => {
    if (!isVisible) {
      const unmountTimeout = setTimeout(() => {
        setShouldRender(false);
      }, 600);
      return () => clearTimeout(unmountTimeout);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div className={`splash-screen-overlay ${isVisible ? 'visible' : 'fade-out'}`}>
      <div className="splash-content">
        {/* Pulsing Crosshair/Radar Concept */}
        <div className="splash-logo-container">
          <div className="radar-circle circle-1"></div>
          <div className="radar-circle circle-2"></div>
          <div className="radar-circle circle-3"></div>
          <div className="splash-logo" aria-hidden="true">🎯</div>
        </div>

        {/* Brand/App Title */}
        <h1 className="splash-title">
          STREAM <span>HUNTER</span>
        </h1>
        <p className="splash-subtitle">منصة اصطياد البث المباشر والأفلام</p>

        {/* Glowing Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Status Meta */}
        <div className="progress-meta">
          <span className="progress-percent">{progress}%</span>
          <p className="splash-status">{statusText}</p>
        </div>
      </div>
    </div>
  );
}
