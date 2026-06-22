"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MovieCard from "../../components/MovieCard";
import { Search } from "lucide-react";

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

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [movies, setMovies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMovies = async () => {
    if (!query) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://live-world-cup.onrender.com/api/search?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) {
        throw new Error("فشل جلب البيانات من الخادم");
      }
      const data = await response.json();
      setMovies(data);
    } catch (err) {
      console.error("Error fetching search results:", err);
      setError(err.message || "حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, [query]);

  if (!query) {
    return (
      <div
        className="movies-error-box"
        style={{ borderColor: "var(--clr-border)" }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔍</div>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: "700",
            color: "var(--clr-text-dim)",
            marginBottom: "8px",
          }}
        >
          ابدأ البحث
        </h2>
        <p style={{ color: "var(--clr-text-muted)", fontSize: "14px" }}>
          اكتب اسم الفيلم في شريط البحث للبدء.
        </p>
      </div>
    );
  }

  return (
    <div className="movies-grid-container">
      <h1 className="movies-page-title">
        <Search
          size={28}
          className="text-primary"
          style={{ color: "var(--clr-primary)" }}
        />
        نتائج البحث عن:{" "}
        <span style={{ color: "var(--clr-accent)" }}>"{query}"</span>
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
            تعذر الاتصال بسيرفر البحث
          </h2>
          <p
            style={{
              color: "var(--clr-text-muted)",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            تأكد من أن السيرفر الخلفي (Backend) يعمل ثم أعد المحاولة.
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
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>❌</div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: "700",
              color: "var(--clr-text-dim)",
              marginBottom: "8px",
            }}
          >
            لا توجد نتائج
          </h2>
          <p style={{ color: "var(--clr-text-muted)", fontSize: "14px" }}>
            لم نتمكن من العثور على أي فيلم يطابق بحثك. جرب اسماً آخر.
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
  );
}

export default function SearchPage() {
  return (
    <main
      className="movies-container"
      style={{ flex: 1, overflowY: "auto", height: "calc(100vh - 64px)" }}
    >
      <Suspense fallback={<MovieSkeletonGrid />}>
        <SearchResults />
      </Suspense>
    </main>
  );
}
