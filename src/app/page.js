/**
 * ============================================================
 *  STREAM HUNTER – الصفحة الرئيسية (Dashboard)
 * ============================================================
 *
 *  تدفق البيانات من منظور الـ Client:
 *
 *  1. [Mount] → useEffect → GET /api/schedule
 *     ↓
 *  2. [Render] جدول المباريات في الـ Sidebar
 *     ↓
 *  3. [User Click] "شاهد الآن" →
 *     - setCurrentMatch(match)
 *     - setIsLoading(true) → تظهر رسالة "يقنص إشارة البث"
 *     - video.src = `/api/stream?url=${match.targetSiteUrl}`
 *     ↓
 *  4. [onLoadStart] → setIsLoading(false) → يختفي الـ Loader
 *  5. [onError]    → setError(true) → تظهر رسالة الخطأ
 *  6. [Unmount / مباراة جديدة] → video.src = '' → FFmpeg يُوقَف تلقائياً
 * ============================================================
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGetScheduleQuery } from '../store/streamApi';

// ─── Skeleton Loader للمباريات ────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="skeleton-line" style={{ width: '60%' }} />
        <div className="skeleton-line" style={{ width: '25%', marginRight: 'auto' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div className="skeleton-line tall" />
        <div style={{ flex: 1 }}>
          <div className="skeleton-line wide" />
          <div className="skeleton-line short" />
        </div>
        <div className="skeleton-line" style={{ width: 20, height: 20 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-line wide" />
          <div className="skeleton-line short" />
        </div>
        <div className="skeleton-line tall" />
      </div>
      <div className="skeleton-line" style={{ width: '40%' }} />
    </div>
  );
}

// ─── بطاقة مباراة واحدة ──────────────────────────────────────────────────────
function MatchCard({ match, isActive, onWatch }) {
  return (
    <div
      className={`match-card ${isActive ? 'active' : ''}`}
      onClick={() => onWatch(match)}
      id={`match-card-${match.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onWatch(match)}
      aria-label={`مباراة ${match.homeTeam} ضد ${match.awayTeam}`}
    >
      {/* البطولة + بادج المباشر */}
      <div className="match-competition">
        <span>{match.competition}</span>
        {match.isLive && (
          <span className="live-badge">
            <span className="live-badge-dot" />
            مباشر
          </span>
        )}
      </div>

      {/* الفريقان */}
      <div className="match-teams">
        <div className="match-team">
          <div className="team-logo">{match.homeLogo || '⚽'}</div>
          <span className="team-name">{match.teamA}</span>
        </div>

        <div className="match-vs">VS</div>

        <div className="match-team">
          <div className="team-logo">{match.awayLogo || '⚽'}</div>
          <span className="team-name">{match.teamB}</span>
        </div>
      </div>

      {/* الوقت + زر المشاهدة */}
      <div className="match-footer">
        <span className="match-time">
          🕐 {match.time || 'قريباً'}
        </span>
        <button
          className="watch-btn"
          id={`watch-btn-${match.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onWatch(match);
          }}
          aria-label={`شاهد مباراة ${match.homeTeam} ضد ${match.awayTeam}`}
        >
          ▶ شاهد الآن
        </button>
      </div>
    </div>
  );
}

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function HomePage() {
  // ─── State ──────────────────────────────────────────────────────────────
  const [currentMatch, setCurrentMatch] = useState(null);      // المباراة المحددة
  const [isLoadingStream, setIsLoadingStream] = useState(false); // loading البث
  const [hasError, setHasError]         = useState(false);     // خطأ في البث
  const [arabicDate, setArabicDate]     = useState('');        // التاريخ (client-only لتجنب hydration mismatch)

  // ─── RTK Query ──────────────────────────────────────────────────────────
  const { data, isLoading: loadingMatches, isError: scheduleError } = useGetScheduleQuery();
  const matches = data || [];
  const dataSource = data?.source || '';
  const liveCount = matches.filter((m) => m.isLive).length;

  // ─── Refs ───────────────────────────────────────────────────────────────
  const videoRef = useRef(null); // مرجع لعنصر الفيديو

  // ─── تعيين التاريخ بالعربية (client-only) ───────────────────────────────
  useEffect(() => {
    setArabicDate(
      new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  // ─── تشغيل مباراة ────────────────────────────────────────────────────────
  /**
   * عند الضغط على "شاهد الآن":
   * 1. تحديث الـ state
   * 2. إعادة تعيين الفيديو (إيقاف FFmpeg القديم)
   * 3. تعيين src الجديد → يُطلق طلب بث جديد للسيرفر
   */
  const handleWatchMatch = useCallback((match) => {
    if (!match.targetSiteUrl) {
      alert('لا يوجد رابط بث متاح لهذه المباراة.');
      return;
    }

    // إعادة تعيين الحالة
    setCurrentMatch(match);
    setIsLoadingStream(true);
    setHasError(false);

    const video = videoRef.current;
    if (!video) return;

    // إيقاف البث القديم أولاً (يُغلق FFmpeg على السيرفر عبر abort signal)
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.classList.remove('visible');

    // جلب رابط البث من السيرفر
    setTimeout(async () => {
      try {
        const streamApiUrl = `http://localhost:3001/api/stream?url=${encodeURIComponent(match.targetSiteUrl)}`;
        const response = await fetch(streamApiUrl);
        const data = await response.json();

        if (data.m3u8Url) {
          video.src = data.m3u8Url;
          video.load();
          video.play().catch(() => {
            // autoplay قد يكون محظوراً → لا بأس، المستخدم يضغط play يدوياً
          });
        } else {
          setIsLoadingStream(false);
          setHasError(true);
          alert(data.error || 'لم يتم العثور على رابط m3u8');
        }
      } catch (err) {
        setIsLoadingStream(false);
        setHasError(true);
        console.error('Error fetching stream:', err);
      }
    }, 100);
  }, []);

  // ─── إعادة المحاولة ───────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (currentMatch) {
      handleWatchMatch(currentMatch);
    }
  }, [currentMatch, handleWatchMatch]);

  // ─── أحداث الفيديو ───────────────────────────────────────────────────────
  /**
   * onLoadStart: بدأ استقبال البيانات → أخفِ الـ Loader
   * يعني السيرفر اصطاد .m3u8 وFFmpeg يُرسل البيانات
   */
  const handleVideoLoadStart = () => {
    setIsLoadingStream(false);
    setHasError(false);

    const video = videoRef.current;
    if (video) {
      video.classList.add('visible');
    }

    // إضافة تأثير streaming للـ wrapper
    const wrapper = document.getElementById('video-wrapper');
    if (wrapper) wrapper.classList.add('streaming');
  };

  /**
   * onError: فشل البث
   */
  const handleVideoError = () => {
    // تجنب الخطأ الزائف عند تفريغ الـ src
    const video = videoRef.current;
    if (!video || !video.src || video.src === window.location.href) return;

    setIsLoadingStream(false);
    setHasError(true);

    const wrapper = document.getElementById('video-wrapper');
    if (wrapper) wrapper.classList.remove('streaming');
  };

  /**
   * onPlaying: الفيديو يُعرض فعلاً
   */
  const handleVideoPlaying = () => {
    setIsLoadingStream(false);
    setHasError(false);
  };

  /**
   * onWaiting: الفيديو ينتظر بيانات (buffering)
   * لا نُظهر الـ Loader هنا لتجنب الوميض
   */

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">

      {/* ══════════════════════════════════════════
          NAVBAR
          ══════════════════════════════════════════ */}
      <nav className="navbar" role="navigation" aria-label="شريط التنقل الرئيسي">
        <div className="navbar-brand">
          <div className="brand-logo" aria-hidden="true">📡</div>
          <div className="brand-name">
            كورة <span>لايف</span>
          </div>
        </div>

        <div className="navbar-meta">
          {liveCount > 0 && (
            <div className="live-indicator" role="status" aria-live="polite">
              <span className="live-dot" aria-hidden="true" />
              {liveCount} مباراة مباشرة
            </div>
          )}
          {dataSource === 'fallback' && (
            <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
              📦 بيانات تجريبية
            </span>
          )}
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          MAIN CONTENT: Sidebar + Player
          ══════════════════════════════════════════ */}
      <main className="main-content">

        {/* ─── Player Area (يسار) ─────────────────────────────────────── */}
        <section className="player-area" aria-label="مشغل البث">

          {/* ─── Video Wrapper ──────────────────────────────────────────── */}
          <div className="video-container">
            <div className="video-wrapper" id="video-wrapper">

              {/* Placeholder: قبل اختيار مباراة */}
              {!currentMatch && (
                <div className="video-placeholder" id="video-placeholder">
                  <div className="placeholder-icon" aria-hidden="true">📺</div>
                  <div className="placeholder-title">اختر مباراة لبدء البث</div>
                  <p className="placeholder-sub">
                    اضغط على «شاهد الآن» بجانب أي مباراة في القائمة الجانبية
                    وسيقوم السيرفر تلقائياً باصطياد إشارة البث.
                  </p>
                </div>
              )}

              {/* Loader Overlay: أثناء اصطياد .m3u8 */}
              <div
                className={`video-loader ${isLoadingStream ? 'visible' : ''}`}
                role="status"
                aria-live="assertive"
                aria-label="جارٍ اصطياد البث"
              >
                <div className="spinner-wrap" aria-hidden="true">
                  <div className="spinner-outer" />
                  <div className="spinner-inner" />
                  <div className="loader-icon">🎯</div>
                </div>
                <div className="loader-text-wrap">
                  <div className="loader-title">السيرفر يقنص إشارة البث الآن...</div>
                  <div className="loader-sub">
                    Puppeteer يفحص الصفحة • FFmpeg جاهز للتحويل
                  </div>
                </div>
              </div>

              {/* Error Overlay */}
              <div
                className={`error-overlay ${hasError ? 'visible' : ''}`}
                role="alert"
              >
                <div className="error-icon" aria-hidden="true">📡</div>
                <div className="error-title">تعذّر اصطياد إشارة البث</div>
                <p className="error-sub">
                  قد يكون الموقع الخارجي محمياً أو تغيّر هيكله.
                  جرب مباراة أخرى أو حاول مرة ثانية.
                </p>
                <button
                  className="retry-btn"
                  id="retry-btn"
                  onClick={handleRetry}
                  aria-label="إعادة المحاولة"
                >
                  🔄 إعادة المحاولة
                </button>
              </div>

              {/* ─── عنصر الفيديو الرئيسي (HTML5 Video) ─────────────── */}
              {/*
                 src يُضبَط ديناميكياً عند الضغط على "شاهد الآن"
                 يشير إلى /api/stream?url=<targetSiteUrl>
                 السيرفر يُعيد Fragmented MP4 stream مباشرة
              */}
              <video
                ref={videoRef}
                id="main-video"
                controls
                autoPlay
                muted
                playsInline
                preload="none"
                title={
                  currentMatch
                    ? `${currentMatch.homeTeam} vs ${currentMatch.awayTeam}`
                    : 'بث مباشر'
                }
                onLoadStart={handleVideoLoadStart}
                onError={handleVideoError}
                onPlaying={handleVideoPlaying}
                aria-label={
                  currentMatch
                    ? `يتم بث مباراة ${currentMatch.homeTeam} ضد ${currentMatch.awayTeam}`
                    : 'مشغل الفيديو'
                }
              />
            </div>
          </div>

          {/* ─── Now Playing Bar ─────────────────────────────────────────── */}
          <div
            className={`now-playing ${!currentMatch ? 'hidden' : ''}`}
            id="now-playing"
            role="status"
            aria-live="polite"
          >
            {currentMatch && (
              <>
                <div className="now-playing-indicator">
                  <span className="live-dot" aria-hidden="true" />
                  بث مباشر
                </div>
                <div>
                  <div className="now-playing-teams">
                    {currentMatch.homeTeam} ⚔ {currentMatch.awayTeam}
                  </div>
                  <div className="now-playing-comp">{currentMatch.competition}</div>
                </div>
                <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--clr-text-muted)' }}>
                  🕐 {currentMatch.time}
                </div>
              </>
            )}
          </div>

        </section>

        {/* ─── Sidebar: جدول المباريات (يمين بسبب RTL) ────────────────────── */}
        <aside className="sidebar" aria-label="جدول مباريات اليوم">
          <div className="sidebar-header">
            <div className="sidebar-title">مباريات اليوم</div>
            {/* suppressHydrationWarning: التاريخ يُحسَب client-side فقط */}
            <div className="sidebar-date" suppressHydrationWarning>{arabicDate}</div>
          </div>

          <div className="matches-list" id="matches-list" role="list">

            {/* حالة التحميل: عرض Skeletons */}
            {loadingMatches && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {/* حالة عدم وجود مباريات */}
            {!loadingMatches && matches.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: scheduleError ? 'var(--clr-accent)' : 'var(--clr-text-muted)',
                  fontSize: 14,
                }}
                role="status"
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>{scheduleError ? '❌' : '📅'}</div>
                {scheduleError ? 'حدث خطأ في جلب المباريات' : 'لا توجد مباريات اليوم'}
              </div>
            )}

            {/* قائمة المباريات */}
            {!loadingMatches &&
              matches.map((match, index) => (
                <div
                  key={match.id}
                  style={{ animationDelay: `${index * 60}ms` }}
                  role="listitem"
                >
                  <MatchCard
                    match={match}
                    isActive={currentMatch?.id === match.id}
                    onWatch={handleWatchMatch}
                  />
                </div>
              ))}

          </div>
        </aside>

      </main>
    </div>
  );
}
