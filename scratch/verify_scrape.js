async function verify() {
  console.log(
    "Fetching new schedule from https://live-world-cup.onrender.com/api/schedule...",
  );
  try {
    const res = await fetch("https://live-world-cup.onrender.com/api/schedule");
    const matches = await res.json();
    console.log(`Successfully fetched ${matches.length} matches.`);

    let badLinksCount = 0;
    matches.forEach((m) => {
      console.log(
        `\nMatch: ${m.teamA} VS ${m.teamB} (Live: ${m.isLive}, Time: ${m.time})`,
      );
      console.log(`  Primary Link: ${m.targetSiteUrl}`);

      const allLinks = [m.targetSiteUrl, ...(m.alternativeUrls || [])];
      allLinks.forEach((link) => {
        const isBad =
          link.includes("poiy.online") ||
          link.includes("fila7lam.com") ||
          link.includes("live-soccer.tv") ||
          link.includes("blogspot.com") ||
          /\/\d{4}\/\d{2}\//.test(link) ||
          [
            "scholarship",
            "insurance",
            "loan",
            "investing",
            "wealth",
            "estate",
          ].some((kw) => link.includes(kw));

        if (isBad) {
          console.log(`  ❌ Bad Link Detected: ${link}`);
          badLinksCount++;
        } else {
          console.log(`  ✅ Valid Link: ${link}`);
        }
      });
    });

    console.log(`\n=========================================`);
    console.log(`Verification Complete. Bad Links Found: ${badLinksCount}`);
  } catch (err) {
    console.error("Error during verification:", err.message);
  }
}

verify();
