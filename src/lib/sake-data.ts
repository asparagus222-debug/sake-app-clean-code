/**
 * @fileOverview 修正後的清酒資料庫。
 * 包含使用者喜愛的「花風 (稻與龍舌蘭)」、「白木久」系列。
 */

export interface SakeDatabaseEntry {
  brand: string;
  brewery: string;
  location: string;
}

export const SAKE_DATABASE: SakeDatabaseEntry[] = [
  // --- 使用者推薦 (User Favorites) ---
  { brand: "花風", brewery: "稻與龍舌蘭", location: "秋田縣" },
  { brand: "稻與龍舌蘭", brewery: "稻與龍舌蘭", location: "秋田縣" },
  { brand: "白木久", brewery: "白杉酒造", location: "京都府" },
  { brand: "銀シャリ", brewery: "白杉酒造", location: "京都府" },
  { brand: "BLACK SWAN", brewery: "白杉酒造", location: "京都府" },

  // --- 頂級名柄 (Top Brands) ---
  { brand: "十四代", brewery: "高木酒造", location: "山形縣" },
  { brand: "新政 No.6", brewery: "新政酒造", location: "秋田縣" },
  { brand: "而今", brewery: "木屋正酒造", location: "三重縣" },
  { brand: "信州龜齡", brewery: "岡崎酒造", location: "長野縣" },
  { brand: "寒菊", brewery: "寒菊銘醸", location: "千葉縣" },
  { brand: "陽乃鳥", brewery: "新政酒造", location: "秋田縣" },
  { brand: "天美", brewery: "長州酒造", location: "山口縣" },
  { brand: "赤武 AKABU", brewery: "赤武酒造", location: "岩手縣" },
  { brand: "寫樂", brewery: "宮泉銘醸", location: "福島縣" },
  { brand: "飛露喜", brewery: "廣木酒造本店", location: "福島縣" },
  { brand: "鳳凰美田", brewery: "小林酒造", location: "栃木縣" },
  { brand: "磯自慢", brewery: "磯自慢酒造", location: "靜岡縣" },
  { brand: "黑龍", brewery: "黑龍酒造", location: "福井縣" },
  { brand: "獺祭", brewery: "旭酒造", location: "山口縣" },
  { brand: "仙禽", brewery: "せんきん", location: "栃木縣" },
  { brand: "作 ZAKU", brewery: "清水清三郎商店", location: "三重縣" },
  { brand: "鍋島", brewery: "富久千代酒造", location: "佐賀縣" },
  { brand: "風之森", brewery: "油長酒造", location: "奈良縣" },
  { brand: "加茂錦 荷札酒", brewery: "加茂錦酒造", location: "新潟縣" },
  { brand: "東洋美人", brewery: "澄川酒造場", location: "山口縣" },
  { brand: "紀土 KID", brewery: "平和酒造", location: "和歌山縣" },
  { brand: "澤屋まつもと", brewery: "松本酒造", location: "京都府" },
  { brand: "久保田", brewery: "朝日酒造", location: "新潟縣" },
  { brand: "八海山", brewery: "八海醸造", location: "新潟縣" },
  { brand: "南部美人", brewery: "南部美人", location: "岩手縣" },
  { brand: "出羽櫻", brewery: "出羽桜酒造", location: "山形縣" },
  { brand: "梵", brewery: "加藤吉平商店", location: "福井縣" },
  { brand: "田酒", brewery: "西田酒造店", location: "青森縣" },
  { brand: "七賢", brewery: "山梨銘醸", location: "山梨縣" },

  // --- Craft Sake (精釀清酒/新興類型) ---
  { brand: "LIBROM", brewery: "LIBROM Craft Sake Brewery", location: "福岡縣" },
  { brand: "WAKAZE", brewery: "WAKAZE", location: "山形縣/法國" },
  { brand: "haccoba", brewery: "haccoba -Craft Sake Brewery-", location: "福島縣" },
  { brand: "ぷくぷく醸造", brewery: "ぷくぷく醸造", location: "福島縣" },
  { brand: "LAGOON BREWERY", brewery: "LAGOON BREWERY", location: "新潟縣" },
  { brand: "阿部酒造", brewery: "阿部酒造", location: "新潟縣" },
  { brand: "屋守", brewery: "豐島屋酒造", location: "東京都" }
];

/**
 * 去除 AI 或搜尋引擎附加在名稱後面的括號翻譯，例如：
 *   "杉の森酒造 (suginomori brewery)" → "杉の森酒造"
 *   "narai passage (ナライ パッセージ)" → "narai passage"
 *   "十四代 (Juyondai)" → "十四代"
 */
export function cleanSakeName(name: string): string {
  if (!name) return name;
  return name
    .replace(/\s*[\(（][^\)）]{1,80}[\)）]\s*$/, '') // 去除結尾括號翻譯
    .trim();
}

/**
 * AI 辨識後的銘柄標準化：對比 SAKE_DATABASE，若命中則回傳正規化名稱，
 * 避免同一銘柄因漢字/片假名/羅馬字差異變成多筆不同紀錄。
 *
 * 額外傳入 knownBrands 可比對使用者已存紀錄中的銘柄，優先回傳已有的寫法。
 */
export function normalizeSakeInfo(
  brandName: string,
  brewery: string,
  origin: string,
  knownBrands: Array<{ brandName: string; brewery: string; origin?: string }> = []
): { brandName: string; brewery: string; origin: string } {
  // 先清除括號翻譯（e.g. "杉の森酒造 (suginomori brewery)" → "杉の森酒造"）
  brandName = cleanSakeName(brandName);
  brewery = cleanSakeName(brewery);
  origin = cleanSakeName(origin);

  // 正規化比對用字串：全小寫、去空白、去常見分隔符
  const norm = (s: string) =>
    s.toLowerCase().replace(/[\s\u3000・·･]/g, '').replace(/[（(][^）)]*[）)]/g, '');
  const buildBrandKeys = (s: string) => {
    const cleaned = cleanSakeName(s);
    const parts = cleaned.split(/[\s\u3000\/]+/).map(norm).filter(Boolean);
    return new Set([norm(cleaned), ...parts]);
  };

  const nBrand = norm(brandName);
  const nBrewery = norm(brewery);
  const brandKeys = buildBrandKeys(brandName);

  // ① 先比對使用者已存的銘柄（優先使用已有的書寫方式）
  for (const known of knownBrands) {
    const knownKeys = buildBrandKeys(known.brandName);
    const brandMatch = [...knownKeys].some(key => key.length >= 2 && brandKeys.has(key));
    if (brandMatch) {
      return { brandName: known.brandName, brewery: known.brewery, origin: known.origin || origin };
    }
  }

  // ② 比對 SAKE_DATABASE
  for (const entry of SAKE_DATABASE) {
    const entryKeys = buildBrandKeys(entry.brand);
    const brandMatch = [...entryKeys].some(key => key.length >= 2 && brandKeys.has(key));
    const entryBrewery = norm(entry.brewery);
    const breweryMatch = nBrewery.length >= 2 && nBrewery === entryBrewery;
    if (brandMatch || (breweryMatch && brandMatch)) {
      return { brandName: entry.brand, brewery: entry.brewery, origin: entry.location };
    }
  }

  // ③ 無匹配，原樣回傳
  return { brandName, brewery, origin };
}
