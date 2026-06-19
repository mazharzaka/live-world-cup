'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useGetScheduleQuery } from '../store/streamApi';
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const { data } = useGetScheduleQuery();
  const matches = data || [];
  const liveCount = matches.filter((m) => m.isLive).length;
  
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
      <div className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginRight: '24px', marginLeft: 'auto' }}>
        <Link 
          href="/" 
          className={`nav-link ${pathname === '/' ? 'active' : ''}`}
          style={{
            color: pathname === '/' ? 'var(--clr-primary)' : 'var(--clr-text-dim)',
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '14px',
            padding: '6px 16px',
            borderRadius: 'var(--radius-md)',
            background: pathname === '/' ? 'var(--clr-primary-subtle)' : 'transparent',
            border: pathname === '/' ? '1px solid var(--clr-primary)' : '1px solid transparent',
            transition: 'all var(--transition)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⚽ المباريات
        </Link>
        <Link 
          href="/movies" 
          className={`nav-link ${pathname === '/movies' ? 'active' : ''}`}
          style={{
            color: pathname === '/movies' ? 'var(--clr-primary)' : 'var(--clr-text-dim)',
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '14px',
            padding: '6px 16px',
            borderRadius: 'var(--radius-md)',
            background: pathname === '/movies' ? 'var(--clr-primary-subtle)' : 'transparent',
            border: pathname === '/movies' ? '1px solid var(--clr-primary)' : '1px solid transparent',
            transition: 'all var(--transition)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🎬 الأفلام الأجنبية
        </Link>
        <Link 
          href="/movies/arabic" 
          className={`nav-link ${pathname === '/movies/arabic' ? 'active' : ''}`}
          style={{
            color: pathname === '/movies/arabic' ? 'var(--clr-primary)' : 'var(--clr-text-dim)',
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '14px',
            padding: '6px 16px',
            borderRadius: 'var(--radius-md)',
            background: pathname === '/movies/arabic' ? 'var(--clr-primary-subtle)' : 'transparent',
            border: pathname === '/movies/arabic' ? '1px solid var(--clr-primary)' : '1px solid transparent',
            transition: 'all var(--transition)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🎭 الأفلام العربية
        </Link>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', background: 'var(--clr-bg)', borderRadius: 'var(--radius-full)', padding: '4px 12px', border: '1px solid var(--clr-border)' }}>
        <Search size={16} color="var(--clr-text-dim)" />
        <input 
          type="text" 
          placeholder="ابحث عن فيلم..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--clr-text)',
            outline: 'none',
            padding: '4px 8px',
            fontSize: '14px',
            width: '180px'
          }}
        />
      </form>

      <div className="navbar-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '16px' }}>
        {liveCount > 0 && (
          <div className="live-indicator" role="status" aria-live="polite">
            <span className="live-dot" aria-hidden="true" />
            {liveCount} مباشر
          </div>
        )}
      </div>
    </nav>
  );
}
