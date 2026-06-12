const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const replacements = [
  ['// السماح لطلبات Next.js', '// Allow Next.js requests'],
  ['// 15 دقيقة لتوفير موارد السيرفر وعدم فتح البراوزر مراراً', '// 15 minutes to save server resources and avoid opening browser repeatedly'],
  ['الدوري الإسباني (تجريبي)', 'Spanish League (Test)'],
  ['الدوري المصري (تجريبي)', 'Egyptian League (Test)'],
  ['الدوري الإنجليزي (تجريبي)', 'English League (Test)'],
  ["console.log('\\n🔍 [Schedule] بدء البحث عن كورة لايف عبر جوجل لتجنب الحجب...');", "console.log('\\n🔍 [Schedule] Starting DuckDuckGo search for Kora Live to avoid blocks...');"],
  ['// 1. البحث في محرك DuckDuckGo لتجنب حجب جوجل واصطياد الدومين الجديد', '// 1. Search in DuckDuckGo to avoid Google blocks and catch new domain'],
  ["console.warn('⚠️ [Schedule] خطأ أثناء فتح بحث DuckDuckGo:', gErr.message);", "console.warn('⚠️ [Schedule] Error while opening DuckDuckGo search:', gErr.message);"],
  ["console.warn('⚠️ [Schedule] لم نتمكن من العثور على رابط كورة لايف النشط من جوجل.');", "console.warn('⚠️ [Schedule] Could not find active Kora Live link from search.');"],
  ['// 2. تجربة الدومينات بالترتيب', '// 2. Try domains in order'],
  ["console.log(`🔍 [Schedule] محاولة الدخول وقشط: ${url}`);", "console.log(`🔍 [Schedule] Attempting to enter and scrape: ${url}`);"],
  ['// التقاط أي استجابة JSON بغض النظر عن الرابط لضمان عدم تفويت أي API', '// Capture any JSON response regardless of URL to avoid missing API'],
  ['// البحث عن أي عنصر يبدو كمباراة', '// Search for any item that looks like a match'],
  ['away = "خصم";', 'away = "Opponent";'],
  ["|| 'قريباً',", "|| 'Soon',"],
  ["|| 'مباراة اليوم',", "|| 'Match of the day',"],
  ['// إعطاء فرصة قصيرة لاكتمال جلب الـ API', '// Give short delay for API to complete'],
  ["console.log(`✅ [Schedule] تم اصطياد بيانات API (Network Sniffing) بنجاح ${interceptedMatches.length} مباراة من: ${url}`);", "console.log(`✅ [Schedule] Successfully intercepted API data (Network Sniffing) - ${interceptedMatches.length} matches from: ${url}`);"],
  ['// 3. استخراج المباريات من الـ HTML كبديل إذا لم نجد API', '// 3. Extract matches from HTML as fallback if no API found'],
  ["console.log(`🔄 [Schedule] لم نجد API، جاري استخراج الـ HTML من: ${url}`);", "console.log(`🔄 [Schedule] No API found, extracting HTML from: ${url}`);"],
  ["console.log(`✅ [Schedule] تم القشط بنجاح ${matches.length} مباراة من: ${url}`);", "console.log(`✅ [Schedule] Successfully scraped ${matches.length} matches from: ${url}`);"],
  ['// تم القشط بنجاح، نخرج من اللوب', '// Scraping successful, break loop'],
  ["console.warn(`⚠️ [Schedule] لم يتم العثور على مباريات في: ${url}، ننتقل للدومين التالي...`);", "console.warn(`⚠️ [Schedule] No matches found in: ${url}, moving to next domain...`);"],
  ["console.warn(`❌ [Schedule] فشل في تحميل ${url}: ${err.message}`);", "console.warn(`❌ [Schedule] Failed to load ${url}: ${err.message}`);"],
  ["console.log(`✅ [Schedule] تم الانتهاء بنجاح، عدد المباريات: ${finalMatches.length}`);", "console.log(`✅ [Schedule] Finished successfully, matches found: ${finalMatches.length}`);"],
  ["console.error('❌ [Schedule] فشل القشط:', err.message);", "console.error('❌ [Schedule] Scraping failed:', err.message);"],
  ["console.log('📦 [Schedule] إرجاع المباريات من الكاش (لتوفير الموارد).');", "console.log('📦 [Schedule] Returning matches from cache (saving resources).');"],
  ["console.log('🔄 [Schedule] تعذر القشط أو لا توجد مباريات.. استخدام Fallback Data...');", "console.log('🔄 [Schedule] Scraping failed or no matches.. using Fallback Data...');"],
  ["console.error('💥 [Schedule] خطأ:', err);", "console.error('💥 [Schedule] Error:', err);"],
  ["console.log(`\\n🎯 [Stream] فتح Puppeteer لـ: ${siteUrl}`);", "console.log(`\\n🎯 [Stream] Opening Puppeteer for: ${siteUrl}`);"],
  ["reject(new Error('⏰ مهلة 35 ثانية: لم يُعثر على رابط .m3u8'));", "reject(new Error('⏰ 35s timeout: .m3u8 link not found'));"],
  ["console.log(`✅ [Stream] اصطاد .m3u8: ${reqUrl}`);", "console.log(`✅ [Stream] Caught .m3u8: ${reqUrl}`);"],
  ["console.warn('⚠️ [Stream] تحذير أثناء التصفح:', err.message);", "console.warn('⚠️ [Stream] Navigation warning:', err.message);"],
  ["error: 'يجب تمرير ?url='", "error: 'Must pass ?url='"],
  ["error: 'لم يتم العثور على رابط m3u8'", "error: 'm3u8 link not found'"]
];

for (const [find, replace] of replacements) {
  content = content.replaceAll(find, replace);
}

fs.writeFileSync('server.js', content);
console.log('Done replacing translations');
