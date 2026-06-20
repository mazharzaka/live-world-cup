// test_match_cases.js

function normalizeArabic(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/كونجو/g, "كونغو")
    .replace(/ال/g, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "")
    .trim();
}

function areMatchesSame(m1, m2) {
  const name1 = `${m1.teamA} ${m1.teamB}`;
  const name2 = `${m2.teamA} ${m2.teamB}`;
  
  const norm1 = normalizeArabic(name1);
  const norm2 = normalizeArabic(name2);

  if (norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }

  const words1 = name1
    .split(/[\s🆚]+/)
    .map(w => normalizeArabic(w))
    .filter(w => w.length > 2);
  const words2 = name2
    .split(/[\s🆚]+/)
    .map(w => normalizeArabic(w))
    .filter(w => w.length > 2);

  let matches = 0;
  for (const w of words1) {
    if (words2.includes(w)) matches++;
  }

  return (
    matches >= 2 ||
    (words1.length === 2 && matches >= 1)
  );
}

const testCases = [
  {
    m1: { teamA: "الأهلي", teamB: "الزمالك" },
    m2: { teamA: "الاهلى", teamB: "الزمالك بث مباشر" },
    description: "الأهلي/الاهلى (ى/ي) وحذف الكلمات الزائدة"
  },
  {
    m1: { teamA: "ريال مدريد", teamB: "برشلونة" },
    m2: { teamA: "ريال مدريد", teamB: "برشلونه" },
    description: "برشلونة/برشلونه (ة/ه)"
  },
  {
    m1: { teamA: "مانشستر يونايتد", teamB: "ليفربول" },
    m2: { teamA: "مانشستر يونايتد اف سي", teamB: "ليفربول" },
    description: "مانشستر يونايتد / مانشستر يونايتد اف سي (تطابق جزئي واحتواء)"
  },
  {
    m1: { teamA: "ألمانيا", teamB: "إيطاليا" },
    m2: { teamA: "المانيا", teamB: "ايطاليا" },
    description: "ألمانيا/المانيا و إيطاليا/ايطاليا (أ/إ/آ -> ا)"
  },
  {
    m1: { teamA: "فرنسا", teamB: "السنغال قمة الديوك" },
    m2: { teamA: "فرنسا", teamB: "السنغال" },
    description: "حذف الـ التعريف وتجاهل العبارات الإضافية"
  }
];

console.log("=== RUNNING GROUPING TESTS ===");
testCases.forEach((tc, idx) => {
  const result = areMatchesSame(tc.m1, tc.m2);
  console.log(`\nTest Case ${idx + 1}: ${tc.description}`);
  console.log(`  M1: "${tc.m1.teamA} VS ${tc.m1.teamB}"`);
  console.log(`  M2: "${tc.m2.teamA} VS ${tc.m2.teamB}"`);
  console.log(`  Result: ${result ? "✅ MATCHED (Same Match)" : "❌ FAILED (Different Matches)"}`);
});
