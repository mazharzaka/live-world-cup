"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Film, RefreshCw } from "lucide-react";

function DirectVideoPlayer({ src }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [plyrLoaded, setPlyrLoaded] = useState(false);

  useEffect(() => {
    // 1. Inject Plyr CSS
    const linkId = "plyr-cdn-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://cdn.plyr.io/3.7.8/plyr.css";
      document.head.appendChild(link);
    }

    // 2. Inject Plyr JS
    const scriptId = "plyr-cdn-js";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdn.plyr.io/3.7.8/plyr.js";
      script.async = true;
      script.onload = () => setPlyrLoaded(true);
      document.body.appendChild(script);
    } else {
      if (window.Plyr) {
        setPlyrLoaded(true);
      } else {
        script.addEventListener("load", () => setPlyrLoaded(true));
      }
    }
  }, []);

  useEffect(() => {
    if (!plyrLoaded) return;
    const video = videoRef.current;
    if (!video) return;

    let hls;
    let plyrPlayer;

    const handleKeyDown = (e) => {
      if (!playerRef.current) return;

      // Don't intercept if user is typing in an input or textarea
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      const player = playerRef.current;
      const key = e.key.toLowerCase();
      const code = e.code;

      if (code === "Space" || key === " " || key === "spacebar") {
        e.preventDefault();
        if (player.paused) {
          player.play();
        } else {
          player.pause();
        }
      } else if (code === "ArrowLeft" || key === "arrowleft") {
        e.preventDefault();
        player.currentTime = Math.max(0, player.currentTime - 5);
      } else if (code === "ArrowRight" || key === "arrowright") {
        e.preventDefault();
        player.currentTime = Math.min(
          player.duration || 0,
          player.currentTime + 5,
        );
      } else if (code === "ArrowUp" || key === "arrowup") {
        e.preventDefault();
        player.volume = Math.min(1, player.volume + 0.05);
      } else if (code === "ArrowDown" || key === "arrowdown") {
        e.preventDefault();
        player.volume = Math.max(0, player.volume - 0.05);
      } else if (code === "KeyF" || key === "f" || key === "ب") {
        e.preventDefault();
        player.fullscreen.toggle();
      } else if (code === "KeyM" || key === "m" || key === "ة") {
        e.preventDefault();
        player.muted = !player.muted;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const initPlayer = async () => {
      const Hls = (await import("hls.js")).default;

      const setupPlyr = () => {
        plyrPlayer = new window.Plyr(video, {
          controls: [
            "play-large",
            "play",
            "progress",
            "current-time",
            "duration",
            "mute",
            "volume",
            "captions",
            "settings",
            "pip",
            "airplay",
            "fullscreen",
          ],
          settings: ["captions", "quality", "speed", "loop"],
          keyboard: { focused: true, global: false },
          seekTime: 5,
        });
        playerRef.current = plyrPlayer;
      };

      if (src.includes(".m3u8") || src.includes("urlset")) {
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setupPlyr();
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          setupPlyr();
        }
      } else {
        video.src = src;
        setupPlyr();
      }
    };

    initPlayer();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, plyrLoaded]);

  return (
    <div
      className="plyr-wrapper w-full h-full rounded-xl overflow-hidden shadow-2xl"
      style={{ width: "100%", height: "100%", background: "#000" }}
    >
      <video
        ref={videoRef}
        className="plyr-video w-full h-full"
        crossOrigin="anonymous"
        playsInline
        controls
      />
    </div>
  );
}

function WatchContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const title =
    searchParams.get("title") ||
    (id && id.startsWith("arabic") ? "فيلم عربي" : "فيلم أجنبي");

  const [streamUrl, setStreamUrl] = useState("");
  const [streamType, setStreamType] = useState("iframe");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchedIdRef = useRef("");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // تحديد الـ API المناسب للبحث عن الفيلم بناءً على الـ ID
  let listApiUrl = "";
  if (id && id.startsWith("englishMovies")) {
    listApiUrl = `${apiBaseUrl}/api/movies/english`;
  } else if (id && id.startsWith("arabicMovies")) {
    listApiUrl = `${apiBaseUrl}/api/movies/arabic`;
  } else if (id && id.startsWith("englishSeries")) {
    listApiUrl = `${apiBaseUrl}/api/series/english`;
  } else if (id && id.startsWith("arabicSeries")) {
    listApiUrl = `${apiBaseUrl}/api/series/arabic`;
  } else {
    listApiUrl = `${apiBaseUrl}/api/movies/english`;
  }

  const fetchStreamUrl = async (bypassCache = false) => {
    if (!id) {
      setError("معرّف الفيلم غير موجود في الطلب.");
      setIsLoading(false);
      return;
    }

    // منع تكرار الطلب لنفس المعرّف (إلا في حالة التحديث اليدوي)
    if (!bypassCache && fetchedIdRef.current === id) {
      return;
    }
    fetchedIdRef.current = id;

    setIsLoading(true);
    setError(null);
    try {
      let url = searchParams.get("targetUrl");

      // إذا لم يكن targetUrl موجوداً في الرابط (للأفلام القديمة)، نبحث عنه في القوائم
      if (!url) {
        const listResponse = await fetch(listApiUrl);
        if (!listResponse.ok) {
          throw new Error("فشل الوصول إلى قائمة الأفلام من الخادم.");
        }
        const movieList = await listResponse.json();
        const movie = movieList.find((m) => m.id === id);

        if (!movie || !movie.targetUrl) {
          throw new Error(
            "لم يتم العثور على الفيلم المطلوب أو الرابط المرجعي له.",
          );
        }
        url = movie.targetUrl;
      }

      console.log("Found movie:", url + "/watch");

      // 2. جلب سيرفر البث المباشر النظيف باستخدام الـ targetUrl الأصلي
      let apiUrl = `${apiBaseUrl}/api/media/stream?targetUrl=${encodeURIComponent(url)}`;
      if (bypassCache) {
        apiUrl += "&bypassCache=true";
      }
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error("فشل جلب سيرفر البث من الخادم.");
      }
      const data = await response.json();
      console.log("Stream URL response:", data);
      if (data.streamUrl) {
        setStreamUrl(data.streamUrl);
        setStreamType(data.type || "iframe");
      } else {
        throw new Error(data.error || "لم يتم العثور على رابط البث النظيف.");
      }
    } catch (err) {
      console.error("Error fetching stream URL:", err);
      setError(err.message || "حدث خطأ أثناء تحميل البث.");
      // تصفير المرجع ليسمح بإعادة المحاولة
      fetchedIdRef.current = "";
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchStreamUrl(false);
    }
  }, [id]);

  return (
    <div className="watch-container">
      {/* زر العودة */}
      <Link
        href={
          id && id.startsWith("arabicMovies") ? "/movies/arabic" : "/movies"
        }
        className="back-btn"
      >
        <ArrowRight size={18} />
        <span>العودة لصفحة الأفلام</span>
      </Link>

      {/* مشغل الفيديو والتحميل */}
      <div className="watch-player-wrapper">
        {/* حالة التحميل Cinematic Loading */}
        {isLoading && (
          <div
            className="video-loader visible"
            style={{ background: "var(--clr-bg)" }}
          >
            <div className="spinner-wrap" aria-hidden="true">
              <div className="spinner-outer" />
              <div className="spinner-inner" />
              <div className="loader-icon">🎯</div>
            </div>
            <div className="loader-text-wrap">
              <div className="loader-title">جاري قنص وتصفية سيرفر البث...</div>
              <div className="loader-sub">
                تجاوز الإعلانات المزعجة • تهيئة المشغل السينمائي
              </div>
            </div>
          </div>
        )}

        {/* حالة الخطأ */}
        {error && (
          <div
            className="error-overlay visible"
            style={{ background: "var(--clr-bg)" }}
          >
            <div className="error-icon" aria-hidden="true">
              📡
            </div>
            <div className="error-title">فشل تشغيل فيلمك المفضّل</div>
            <p className="error-sub">{error}</p>
            <button className="retry-btn" onClick={fetchStreamUrl}>
              <RefreshCw
                size={14}
                style={{ marginLeft: "6px", display: "inline" }}
              />
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* مشغل الفيديو iframe */}
        {!isLoading && !error && streamUrl && streamType === "iframe" && (
          <iframe
            src={streamUrl}
            className="w-full h-full aspect-video rounded-xl shadow-2xl"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: "var(--radius-xl)",
            }}
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            referrerPolicy="no-referrer"
          />
        )}

        {/* مشغل الفيديو المباشر HLS/MP4 */}
        {!isLoading &&
          !error &&
          streamUrl &&
          (streamType === "direct" || streamType === "hls") && (
            <DirectVideoPlayer src={streamUrl} />
          )}
      </div>

      {/* عنوان الفيلم وتفاصيل إضافية */}
      <div
        className="watch-title-area"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 className="watch-movie-title">{title}</h1>
          <p
            style={{
              color: "var(--clr-text-muted)",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Film size={16} />
            <span>بث مباشر نظيف • جودة عالية خالية من الإعلانات المنبثقة</span>
          </p>
        </div>
        <button
          onClick={() => fetchStreamUrl(true)}
          title="إعادة قنص السيرفر وتحديث البث لتجنب الأخطاء أو الكاش التالف"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "var(--clr-text)",
            padding: "10px 18px",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            transition: "all 0.2s",
            outline: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
          }}
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          <span>تحديث البث (إعادة قنص)</span>
        </button>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <main style={{ flex: 1, overflowY: "auto", height: "calc(100vh - 64px)" }}>
      <Suspense
        fallback={
          <div className="watch-container">
            <div className="watch-player-wrapper">
              <div
                className="video-loader visible"
                style={{ background: "var(--clr-bg)" }}
              >
                <div className="spinner-wrap">
                  <div className="spinner-outer" />
                  <div className="spinner-inner" />
                </div>
              </div>
            </div>
          </div>
        }
      >
        <WatchContent />
      </Suspense>
    </main>
  );
}
