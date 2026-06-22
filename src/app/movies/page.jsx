"use client";

import { useState, useEffect } from "react";
import MovieCard from "../../components/MovieCard";
import { Film } from "lucide-react";

function MovieSkeletonGrid() {
  return (
    <div className="movies-loading-grid">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="movies-loading-card">
          <div
            className="skeleton-line"
            style={{ width: "85%", height: "20px", marginBottom: "12px" }}
          />
          <div
            className="skeleton-line"
            style={{ width: "50%", height: "14px" }}
          />
        </div>
      ))}
    </div>
  );
}

export default function MoviesPage() {
  const [movies, setMovies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMovies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "https://live-world-cup.onrender.com/api/movies/english",
      );
      if (!response.ok) {
        throw new Error("فشل جلب البيانات من الخادم");
      }
      const data = await response.json();
      setMovies(data);
    } catch (err) {
      console.error("Error fetching movies:", err);
      setError(err.message || "حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  return (
    <main
      className="movies-container"
      style={{ flex: 1, overflowY: "auto", height: "calc(100vh - 64px)" }}
    >
      <div className="movies-grid-container">
        <h1 className="movies-page-title">
          <Film
            size={28}
            className="text-primary"
            style={{ color: "var(--clr-primary)" }}
          />
          الأفلام الأجنبية
        </h1>

        {isLoading && <MovieSkeletonGrid />}

        {error && (
          <div className="movies-error-box">
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📡</div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "700",
                color: "var(--clr-accent)",
                marginBottom: "8px",
              }}
            >
              تعذر الاتصال بسيرفر الأفلام
            </h2>
            <p
              style={{
                color: "var(--clr-text-muted)",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              تأكد من أن السيرفر الخلفي (Backend) يعمل على المنفذ 3001 ثم أعد
              المحاولة.
            </p>
            <button
              className="retry-btn"
              onClick={fetchMovies}
              style={{ marginTop: 0 }}
            >
              🔄 إعادة المحاولة
            </button>
          </div>
        )}

        {!isLoading && !error && movies.length === 0 && (
          <div
            className="movies-error-box"
            style={{ borderColor: "var(--clr-border)" }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🎬</div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "700",
                color: "var(--clr-text-dim)",
                marginBottom: "8px",
              }}
            >
              لا توجد أفلام حالياً
            </h2>
            <p style={{ color: "var(--clr-text-muted)", fontSize: "14px" }}>
              لم يتم العثور على أي أفلام في هذه الفئة.
            </p>
          </div>
        )}

        {!isLoading && !error && movies.length > 0 && (
          <div className="movies-grid">
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                id={movie.id}
                title={movie.title}
                poster={movie.poster}
                targetUrl={movie.targetUrl}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
