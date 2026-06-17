const cleanMovieUrl = (url) => {
  if (!url) return url;
  let clean = url;
  
  if (clean.includes("rgetUrl=")) {
    clean = decodeURIComponent(clean.split("rgetUrl=")[1]);
  }
  
  if (clean.includes("topcinema")) {
    clean = clean.replace(/\/+watch\/?$/, "");
    clean = clean.endsWith("/") ? clean + "watch" : clean + "/watch";
  } else if (clean.includes("asd.ink") || clean.includes("arabseed")) {
    clean = clean.replace(/\/+watch\/?$/, "");
    clean = clean.endsWith("/") ? clean + "watch/" : clean + "/watch/";
  }
  return clean;
};

console.log("Test 1 (Double Slash):", cleanMovieUrl("https://m.asd.ink/فيلم-الست-2025//watch"));
console.log("Test 2 (Mangled ad URL):", cleanMovieUrl("https://m.asd.ink/فيلم-برشامة-2026-t90/watch/rgetUrl=https://m.asd.ink/%d9%81%d9%8a%d9%84%d9%85-%d8%a7%d9%84%d8%b3%d8%aa-2025//watch"));
