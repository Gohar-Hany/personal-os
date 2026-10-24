export interface QuranPageMeta {
  pageNumber: number
  juzNumber: number
  surahNameAr: string
  imageUrl: string
  fallbackImageUrl: string
}

// Approximate Juz starts by page in standard 604-page Madinah Mus-haf
// Juz 1: page 1, Juz 2: page 22, Juz 3: page 42, etc (~20 pages per Juz)
const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 122, 142, 162, 182,
  202, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
]

export function getJuzForPage(page: number): number {
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i--) {
    if (page >= JUZ_START_PAGES[i]) return i + 1
  }
  return 1
}

// Key surah start pages in the 604-page Madinah Mus-haf
export const SURAH_PAGES = [
  { no: 1, name: "الفاتحة", page: 1 },
  { no: 2, name: "البقرة", page: 2 },
  { no: 3, name: "آل عمران", page: 50 },
  { no: 4, name: "النساء", page: 77 },
  { no: 5, name: "المائدة", page: 106 },
  { no: 6, name: "الأنعام", page: 128 },
  { no: 7, name: "الأعراف", page: 151 },
  { no: 8, name: "الأنفال", page: 177 },
  { no: 9, name: "التوبة", page: 187 },
  { no: 10, name: "يونس", page: 208 },
  { no: 11, name: "هود", page: 221 },
  { no: 12, name: "يوسف", page: 235 },
  { no: 13, name: "الرعد", page: 249 },
  { no: 14, name: "إبراهيم", page: 255 },
  { no: 15, name: "الحجر", page: 262 },
  { no: 16, name: "النحل", page: 267 },
  { no: 17, name: "الإسراء", page: 282 },
  { no: 18, name: "الكهف", page: 293 },
  { no: 19, name: "مريم", page: 305 },
  { no: 20, name: "طه", page: 312 },
  { no: 21, name: "الأنبياء", page: 322 },
  { no: 22, name: "الحج", page: 332 },
  { no: 23, name: "المؤمنون", page: 342 },
  { no: 24, name: "النور", page: 350 },
  { no: 25, name: "الفرقان", page: 359 },
  { no: 26, name: "الشعراء", page: 367 },
  { no: 27, name: "النمل", page: 377 },
  { no: 28, name: "القصص", page: 385 },
  { no: 29, name: "العنكبوت", page: 396 },
  { no: 30, name: "الروم", page: 404 },
  { no: 31, name: "لقمان", page: 411 },
  { no: 32, name: "السجدة", page: 415 },
  { no: 33, name: "الأحزاب", page: 418 },
  { no: 34, name: "سبأ", page: 428 },
  { no: 35, name: "فاطر", page: 434 },
  { no: 36, name: "يس", page: 440 },
  { no: 37, name: "الصافات", page: 446 },
  { no: 38, name: "ص", page: 453 },
  { no: 39, name: "الزمر", page: 458 },
  { no: 40, name: "غافر", page: 467 },
  { no: 41, name: "فصلت", page: 477 },
  { no: 42, name: "الشورى", page: 483 },
  { no: 43, name: "الزخرف", page: 489 },
  { no: 44, name: "الدخان", page: 496 },
  { no: 45, name: "الجاثية", page: 499 },
  { no: 46, name: "الأحقاف", page: 502 },
  { no: 47, name: "محمد", page: 507 },
  { no: 48, name: "الفتح", page: 511 },
  { no: 49, name: "الحجرات", page: 515 },
  { no: 50, name: "ق", page: 518 },
  { no: 51, name: "الذاريات", page: 520 },
  { no: 52, name: "الطور", page: 523 },
  { no: 53, name: "النجم", page: 526 },
  { no: 54, name: "القمر", page: 528 },
  { no: 55, name: "الرحمن", page: 531 },
  { no: 56, name: "الواقعة", page: 534 },
  { no: 57, name: "الحديد", page: 537 },
  { no: 58, name: "المجادلة", page: 542 },
  { no: 59, name: "الحشر", page: 545 },
  { no: 60, name: "الممتحنة", page: 549 },
  { no: 61, name: "الصف", page: 551 },
  { no: 62, name: "الجمعة", page: 553 },
  { no: 63, name: "المنافقون", page: 554 },
  { no: 64, name: "التغابن", page: 556 },
  { no: 65, name: "الطلاق", page: 558 },
  { no: 66, name: "التحريم", page: 560 },
  { no: 67, name: "الملك", page: 562 },
  { no: 68, name: "القلم", page: 564 },
  { no: 69, name: "الحاقة", page: 566 },
  { no: 70, name: "المعارج", page: 568 },
  { no: 71, name: "نوح", page: 570 },
  { no: 72, name: "الجن", page: 572 },
  { no: 73, name: "المزمل", page: 574 },
  { no: 74, name: "المدثر", page: 575 },
  { no: 75, name: "القيامة", page: 577 },
  { no: 76, name: "الإنسان", page: 578 },
  { no: 77, name: "المرسلات", page: 580 },
  { no: 78, name: "النبأ", page: 582 },
  { no: 79, name: "النازعات", page: 583 },
  { no: 80, name: "عبس", page: 585 },
  { no: 81, name: "التكوير", page: 586 },
  { no: 82, name: "الانفطار", page: 587 },
  { no: 83, name: "المطففين", page: 587 },
  { no: 84, name: "الانشقاق", page: 589 },
  { no: 85, name: "البروج", page: 590 },
  { no: 86, name: "الطارق", page: 591 },
  { no: 87, name: "الأعلى", page: 591 },
  { no: 88, name: "الغاشية", page: 592 },
  { no: 89, name: "الفجر", page: 593 },
  { no: 90, name: "البلد", page: 594 },
  { no: 91, name: "الشمس", page: 595 },
  { no: 92, name: "الليل", page: 595 },
  { no: 93, name: "الضحى", page: 596 },
  { no: 94, name: "الشرح", page: 596 },
  { no: 95, name: "التين", page: 597 },
  { no: 96, name: "العلق", page: 597 },
  { no: 97, name: "القدر", page: 598 },
  { no: 98, name: "البينة", page: 598 },
  { no: 99, name: "الزلزلة", page: 599 },
  { no: 100, name: "العاديات", page: 599 },
  { no: 101, name: "القارعة", page: 600 },
  { no: 102, name: "التكاثر", page: 600 },
  { no: 103, name: "العصر", page: 601 },
  { no: 104, name: "الهمزة", page: 601 },
  { no: 105, name: "الفيل", page: 601 },
  { no: 106, name: "قريش", page: 602 },
  { no: 107, name: "الماعون", page: 602 },
  { no: 108, name: "الكوثر", page: 602 },
  { no: 109, name: "الكافرون", page: 603 },
  { no: 110, name: "النصر", page: 603 },
  { no: 111, name: "المسد", page: 603 },
  { no: 112, name: "الإخلاص", page: 604 },
  { no: 113, name: "الفلق", page: 604 },
  { no: 114, name: "الناس", page: 604 },
]

export function getSurahForPage(page: number): string {
  let matched = SURAH_PAGES[0].name
  for (const s of SURAH_PAGES) {
    if (page >= s.page) matched = s.name
    else break
  }
  return `سورة ${matched}`
}

export function getQuranPageMeta(pageNumber: number): QuranPageMeta {
  const p = Math.max(1, Math.min(604, pageNumber))
  const padded = String(p).padStart(3, "0")
  return {
    pageNumber: p,
    juzNumber: getJuzForPage(p),
    surahNameAr: getSurahForPage(p),
    // Official Quran.com Madinah Mus-haf high-res crisp page assets
    imageUrl: `https://android.quran.com/data/width_1260/page${padded}.png`,
    fallbackImageUrl: `https://android.quran.com/data/width_1024/page${padded}.png`,
  }
}

export const TOTAL_QURAN_PAGES = 604
