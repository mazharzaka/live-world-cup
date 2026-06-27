'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useGetScheduleQuery } from '../store/streamApi';
import { Search, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header() {
  const pathname = usePathname();
  const { data } = useGetScheduleQuery();
  const matches = data || [];
  const liveCount = matches.filter((m) => m.isLive).length;
  
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMenuOpen(false);
    }
  };

  return (
    <nav className="navbar" role="navigation" aria-label="شريط التنقل الرئيسي">
      <div className="navbar-brand">
        <div className="brand-logo" aria-hidden="true">📡</div>
        <div className="brand-name">
          ستريم <span>هنتـر</span>
        </div>
      </div>

      {/* روابط التنقل المضافة */}
      <div className="navbar-links">
        <Link 
          href="/" 
          className={`nav-link ${pathname === '/' ? 'active' : ''}`}
        >
          ⚽ المباريات
        </Link>
        <Link 
          href="/movies" 
          className={`nav-link ${pathname === '/movies' ? 'active' : ''}`}
        >
          🎬 الأفلام الأجنبية
        </Link>
        <Link 
          href="/movies/arabic" 
          className={`nav-link ${pathname === '/movies/arabic' ? 'active' : ''}`}
        >
          🎭 الأفلام العربية
        </Link>
      </div>

      <form onSubmit={handleSearch} className="navbar-search">
        <Search size={16} color="var(--clr-text-dim)" />
        <input 
          type="text" 
          placeholder="ابحث عن فيلم..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="navbar-search-input"
        />
      </form>

      <div className="navbar-left-group">
        {liveCount > 0 && (
          <div className="live-indicator" role="status" aria-live="polite">
            <span className="live-dot" aria-hidden="true" />
            {liveCount} مباشر
          </div>
        )}
        <button 
          className="navbar-toggle" 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          aria-label="تبديل القائمة"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* القائمة الجانبية المنسدلة للهواتف */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mobile-drawer"
          >
            {/* البحث في الهاتف */}
            <form onSubmit={handleSearch} className="mobile-search-form">
              <Search size={18} color="var(--clr-text-dim)" />
              <input 
                type="text" 
                placeholder="ابحث عن فيلم..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mobile-search-input"
              />
            </form>
            
            {/* روابط التنقل في الهاتف */}
            <div className="mobile-nav-links">
              <Link 
                href="/" 
                onClick={() => setIsMenuOpen(false)}
                className={`mobile-nav-link ${pathname === '/' ? 'active' : ''}`}
              >
                ⚽ المباريات
              </Link>
              <Link 
                href="/movies" 
                onClick={() => setIsMenuOpen(false)}
                className={`mobile-nav-link ${pathname === '/movies' ? 'active' : ''}`}
              >
                🎬 الأفلام الأجنبية
              </Link>
              <Link 
                href="/movies/arabic" 
                onClick={() => setIsMenuOpen(false)}
                className={`mobile-nav-link ${pathname === '/movies/arabic' ? 'active' : ''}`}
              >
                🎭 الأفلام العربية
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
