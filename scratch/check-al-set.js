async function checkMovie() {
  try {
    const res = await fetch("http://localhost:3001/api/movies/arabic");
    const data = await res.json();
    console.log("Total movies found:", data.length);
    data.forEach((m) => {
      console.log(`Title: "${m.title}", URL: "${m.targetUrl}"`);
    });
  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkMovie();
