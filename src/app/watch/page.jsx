"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Film, RefreshCw } from "lucide-react";

function DirectVideoPlayer({ src }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls;
    const initPlayer = async () => {
      if (src.includes(".m3u8") || src.includes("urlset")) {
        const Hls = (await import("hls.js")).default;
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        }
      } else {
        video.src = src;
      }
    };

    initPlayer();

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      className="w-full h-full aspect-video rounded-xl shadow-2xl video-shell"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: "var(--radius-xl)",
        backgroundColor: "#000",
      }}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
}

function WatchContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const title = searchParams.get("title") || (id && id.startsWith("arabic") ? "فيلم عربي" : "فيلم أجنبي");

  const [streamUrl, setStreamUrl] = useState("");
  const [streamType, setStreamType] = useState("iframe");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchedIdRef = useRef("");

  // تحديد الـ API المناسب للبحث عن الفيلم بناءً على الـ ID
  let listApiUrl = "";
  if (id && id.startsWith("englishMovies")) {
    listApiUrl = "http://https://live-world-cup.onrender.com/api/movies/english";
  } else if (id && id.startsWith("arabicMovies")) {
    listApiUrl = "http://https://live-world-cup.onrender.com/api/movies/arabic";
  } else if (id && id.startsWith("englishSeries")) {
    listApiUrl = "http://https://live-world-cup.onrender.com/api/series/english";
  } else if (id && id.startsWith("arabicSeries")) {
    listApiUrl = "http://https://live-world-cup.onrender.com/api/series/arabic";
  } else {
    listApiUrl = "http://https://live-world-cup.onrender.com/api/movies/english";
  }

  const fetchStreamUrl = async () => {
    if (!id) {
      setError("معرّف الفيلم غير موجود في الطلب.");
      setIsLoading(false);
      return;
    }

    // منع تكرار الطلب لنفس المعرّف
    if (fetchedIdRef.current === id) {
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
      const apiUrl = `http://https://live-world-cup.onrender.com/api/media/stream?targetUrl=${encodeURIComponent(url)}`;
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
      fetchStreamUrl();
    }
  }, [id]);

  return (
    <div className="watch-container">
      {/* زر العودة */}
      <Link href={id && id.startsWith("arabicMovies") ? "/movies/arabic" : "/movies"} className="back-btn">
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
        {!isLoading && !error && streamUrl && (streamType === "direct" || streamType === "hls") && (
          <DirectVideoPlayer src={streamUrl} />
        )}
      </div>

      {/* عنوان الفيلم وتفاصيل إضافية */}
      <div className="watch-title-area">
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
