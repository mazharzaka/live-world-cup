async function testEndpoints() {
  console.log("Waiting 40 seconds for the server to finish scraping...");
  await new Promise((r) => setTimeout(r, 40000));

  console.log("Querying server endpoints...");
  try {
    const arabicRes = await fetch("http://localhost:3001/api/movies/arabic");
    const arabicData = await arabicRes.json();
    console.log(`✅ /api/movies/arabic returned ${arabicData.length} movies.`);
    if (arabicData.length > 0) {
      console.log("Sample Arabic Movie:", arabicData[0]);
    } else {
      console.error("❌ No Arabic movies returned!");
    }

    const englishRes = await fetch("http://localhost:3001/api/movies/english");
    const englishData = await englishRes.json();
    console.log(
      `✅ /api/movies/english returned ${englishData.length} movies.`,
    );
    if (englishData.length > 0) {
      console.log("Sample English Movie:", englishData[0]);
    } else {
      console.error("❌ No English movies returned!");
    }
  } catch (err) {
    console.error("Failed to query endpoints:", err.message);
  }
}

testEndpoints();
