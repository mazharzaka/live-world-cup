/**
 * src/app/layout.js
 * Root Layout لمشروع Stream Hunter
 * يُطبَّق على جميع الصفحات
 */

import './globals.css';
import Providers from './providers';
import Header from '../components/Header';
import SplashScreen from '../components/SplashScreen';

export const metadata = {
  title: '🎬 ستريم هنتر – منصة البث المباشر والأفلام',
  description:
    'شاهد مباريات اليوم والأفلام الأجنبية مباشرة وبدون إعلانات. منصة ذكية لتشغيل البث والأفلام في متصفحك.',
  keywords: 'بث مباشر, مباريات اليوم, أفلام أجنبية, كورة لايف, بث رياضي',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="referrer" content="no-referrer" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <SplashScreen />
          <div className="app-shell">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
