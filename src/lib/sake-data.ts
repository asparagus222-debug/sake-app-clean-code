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
  { brand: "屋守", brewery: "豐島屋酒造", location: "東京都" },

  // --- 辨識別名補強與 SAKETIME 排名擴充 (2026-04) ---
  { brand: "赤武", brewery: "赤武酒造", location: "岩手縣" },
  { brand: "AKABU", brewery: "赤武酒造", location: "岩手縣" },
  { brand: "作", brewery: "清水清三郎商店", location: "三重縣" },
  { brand: "紀土", brewery: "平和酒造", location: "和歌山縣" },
  { brand: "風の森", brewery: "油長酒造", location: "奈良縣" },
  { brand: "黒龍", brewery: "黑龍酒造", location: "福井縣" },
  { brand: "写楽", brewery: "宮泉銘醸", location: "福島縣" },
  { brand: "信州亀齢", brewery: "岡崎酒造", location: "長野縣" },
  { brand: "出羽桜", brewery: "出羽桜酒造", location: "山形縣" },
  { brand: "播州一献", brewery: "山陽盃酒造", location: "兵庫縣" },
  { brand: "森嶋", brewery: "森島酒造", location: "茨城縣" },
  { brand: "望", brewery: "外池酒造店", location: "栃木縣" },
  { brand: "朝日鷹", brewery: "高木酒造", location: "山形縣" },
  { brand: "不老泉", brewery: "上原酒造", location: "滋賀縣" },
  { brand: "聖", brewery: "聖酒造", location: "群馬縣" },
  { brand: "醸し人九平次", brewery: "萬乗醸造", location: "愛知縣" },
  { brand: "五十嵐", brewery: "五十嵐酒造", location: "埼玉縣" },
  { brand: "羽根屋", brewery: "富美菊酒造", location: "富山縣" },
  { brand: "姿", brewery: "飯沼銘醸", location: "栃木縣" },
  { brand: "田中六五", brewery: "白糸酒造", location: "福岡縣" },
  { brand: "村祐", brewery: "村祐酒造", location: "新潟縣" },
  { brand: "王祿", brewery: "王祿酒造", location: "島根縣" },
  { brand: "伯楽星", brewery: "新澤醸造店", location: "宮城縣" },
  { brand: "春霞", brewery: "栗林酒造店", location: "秋田縣" },
  { brand: "和可娘", brewery: "新谷酒造", location: "山口縣" },
  { brand: "尾瀬の雪どけ", brewery: "龍神酒造", location: "群馬縣" },
  { brand: "雨後の月", brewery: "相原酒造", location: "廣島縣" },
  { brand: "翠玉", brewery: "両関酒造", location: "秋田縣" },
  { brand: "雁木", brewery: "八百新酒造", location: "山口縣" },
  { brand: "雪の茅舎", brewery: "齋彌酒造店", location: "秋田縣" },
  { brand: "賀茂金秀", brewery: "金光酒造", location: "廣島縣" },
  { brand: "天賦", brewery: "西酒造", location: "鹿兒島縣" },
  { brand: "天明", brewery: "曙酒造", location: "福島縣" },
  { brand: "山形正宗", brewery: "水戸部酒造", location: "山形縣" },
  { brand: "臥龍梅", brewery: "三和酒造", location: "靜岡縣" },
  { brand: "花の香", brewery: "花の香酒造", location: "熊本縣" },
  { brand: "神蔵", brewery: "松井酒造", location: "京都府" },
  { brand: "桂月", brewery: "土佐酒造", location: "高知縣" },
  { brand: "まんさくの花", brewery: "日の丸醸造", location: "秋田縣" },
  { brand: "日高見", brewery: "平孝酒造", location: "宮城縣" },
  { brand: "笑四季", brewery: "笑四季酒造", location: "滋賀縣" },
  { brand: "能古見", brewery: "馬場酒造場", location: "佐賀縣" },
  { brand: "大雪渓", brewery: "大雪渓酒造", location: "長野縣" },
  { brand: "浦里", brewery: "浦里酒造店", location: "茨城縣" },
  { brand: "玄宰", brewery: "末廣酒造", location: "福島縣" },
  { brand: "真澄", brewery: "宮坂醸造", location: "長野縣" },
  { brand: "悦凱陣", brewery: "丸尾本店", location: "香川縣" },
  { brand: "山間", brewery: "新潟第一酒造", location: "新潟縣" },
  { brand: "篠峯", brewery: "千代酒造", location: "奈良縣" },
  { brand: "会津中将", brewery: "鶴乃江酒造", location: "福島縣" },
  { brand: "山本", brewery: "山本合名会社", location: "秋田縣" },
  { brand: "鶴齢", brewery: "青木酒造", location: "新潟縣" },
  { brand: "十九", brewery: "尾澤酒造場", location: "長野縣" },
  { brand: "武勇", brewery: "武勇", location: "茨城縣" },
  { brand: "流輝", brewery: "松屋酒造", location: "群馬縣" },
  { brand: "常山", brewery: "常山酒造", location: "福井縣" },
  { brand: "土田", brewery: "土田酒造", location: "群馬縣" },
  { brand: "農口尚彦研究所", brewery: "農口尚彦研究所", location: "石川縣" },
  { brand: "宗玄", brewery: "宗玄酒造", location: "石川縣" },
  { brand: "宝剣", brewery: "宝剣酒造", location: "廣島縣" },
  { brand: "大那", brewery: "菊の里酒造", location: "栃木縣" },
  { brand: "久礼", brewery: "西岡酒造店", location: "高知縣" },
  { brand: "上喜元", brewery: "酒田酒造", location: "山形縣" },
  { brand: "花巴", brewery: "美吉野醸造", location: "奈良縣" },
  { brand: "天穏", brewery: "板倉酒造", location: "島根縣" },
  { brand: "月山", brewery: "吉田酒造", location: "島根縣" },
  { brand: "結ゆい", brewery: "結城酒造", location: "茨城縣" },
  { brand: "松の司", brewery: "松瀬酒造", location: "滋賀縣" },
  { brand: "蓬莱泉", brewery: "関谷醸造", location: "愛知縣" },
  { brand: "九頭龍", brewery: "黑龍酒造", location: "福井縣" },
  { brand: "ばくれん", brewery: "亀の井酒造", location: "山形縣" },
  { brand: "大盃", brewery: "牧野酒造", location: "群馬縣" },
  { brand: "笹正宗", brewery: "笹正宗酒造", location: "福島縣" },
  { brand: "来福", brewery: "来福酒造", location: "茨城縣" },
  { brand: "五橋", brewery: "酒井酒造", location: "山口縣" },
  { brand: "石鎚", brewery: "石鎚酒造", location: "愛媛縣" },
  { brand: "SENSATION", brewery: "笑四季酒造", location: "滋賀縣" },
  { brand: "伊予賀儀屋", brewery: "成龍酒造", location: "愛媛縣" },
  { brand: "鼎", brewery: "信州銘醸", location: "長野縣" },
  { brand: "豊香", brewery: "豊島屋", location: "長野縣" },
  { brand: "浦霞", brewery: "佐浦", location: "宮城縣" },
  { brand: "龍力", brewery: "本田商店", location: "兵庫縣" },
  { brand: "神亀", brewery: "神亀酒造", location: "埼玉縣" },
  { brand: "東鶴", brewery: "東鶴酒造", location: "佐賀縣" },
  { brand: "仙介", brewery: "泉酒造", location: "兵庫縣" },
  { brand: "貴", brewery: "永山本家酒造場", location: "山口縣" },
  { brand: "土佐しらぎく", brewery: "仙頭酒造場", location: "高知縣" },
  { brand: "一歩己", brewery: "豊国酒造", location: "福島縣" },
  { brand: "鳴門鯛", brewery: "本家松浦酒造場", location: "德島縣" },
  { brand: "奥播磨", brewery: "下村酒造店", location: "兵庫縣" },
  { brand: "米鶴", brewery: "米鶴酒造", location: "山形縣" },
  { brand: "旦", brewery: "笹一酒造", location: "山梨縣" },
  { brand: "津島屋", brewery: "御代桜醸造", location: "岐阜縣" },
  { brand: "初亀", brewery: "初亀醸造", location: "靜岡縣" },
  { brand: "三連星", brewery: "美冨久酒造", location: "滋賀縣" },
  { brand: "東魁盛", brewery: "小泉酒造", location: "千葉縣" },
  { brand: "HIZIRIZM", brewery: "聖酒造", location: "群馬縣" },
  { brand: "千代むすび", brewery: "千代むすび酒造", location: "鳥取縣" },
  { brand: "酒屋八兵衛", brewery: "元坂酒造", location: "三重縣" },
  { brand: "花垣", brewery: "南部酒造場", location: "福井縣" },
  { brand: "大山", brewery: "加藤嘉八郎酒造", location: "山形縣" },
  { brand: "北雪", brewery: "北雪酒造", location: "新潟縣" },
  { brand: "黒牛", brewery: "名手酒造店", location: "和歌山縣" },
  { brand: "瀧自慢", brewery: "瀧自慢酒造", location: "三重縣" },
  { brand: "初孫", brewery: "東北銘醸", location: "山形縣" },
  { brand: "永平寺白龍", brewery: "吉田酒造", location: "福井縣" },
  { brand: "甍", brewery: "甍酒蔵", location: "長野縣" },
  { brand: "乾坤一", brewery: "大沼酒造店", location: "宮城縣" },
  { brand: "長陽福娘", brewery: "岩崎酒造", location: "山口縣" },
  { brand: "十勝", brewery: "上川大雪酒造", location: "北海道" },
  { brand: "原田", brewery: "はつもみぢ", location: "山口縣" },
  { brand: "秋鹿", brewery: "秋鹿酒造", location: "大阪府" },
  { brand: "夜明け前", brewery: "小野酒造店", location: "長野縣" },
  { brand: "泉川", brewery: "廣木酒造本店", location: "福島縣" },
  { brand: "讃岐くらうでぃ", brewery: "川鶴酒造", location: "香川縣" },
  { brand: "黒澤", brewery: "黒澤酒造", location: "長野縣" },
  { brand: "亀齢", brewery: "亀齢酒造", location: "廣島縣" },
  { brand: "至", brewery: "逸見酒造", location: "新潟縣" },
  { brand: "孝の司", brewery: "柴田酒造場", location: "愛知縣" },
  { brand: "いづみ橋", brewery: "泉橋酒造", location: "神奈川縣" },
  { brand: "三芳菊", brewery: "三芳菊酒造", location: "德島縣" },
  { brand: "墨廼江", brewery: "墨廼江酒造", location: "宮城縣" },
  { brand: "富久長", brewery: "今田酒造本店", location: "廣島縣" },
  { brand: "龍神", brewery: "龍神酒造", location: "群馬縣" },
  { brand: "蓬莱", brewery: "渡辺酒造店", location: "岐阜縣" },
  { brand: "早瀬浦", brewery: "三宅彦右衛門酒造", location: "福井縣" },
  { brand: "長門峡", brewery: "岡崎酒造場", location: "山口縣" },
  { brand: "麒麟山", brewery: "麒麟山酒造", location: "新潟縣" },
  { brand: "鏡山", brewery: "小江戸鏡山酒造", location: "埼玉縣" },
  { brand: "南", brewery: "南酒造場", location: "高知縣" },
  { brand: "英君", brewery: "英君酒造", location: "靜岡縣" },
  { brand: "阿部勘", brewery: "阿部勘酒造店", location: "宮城縣" },
  { brand: "山の井", brewery: "会津酒造", location: "福島縣" },
  { brand: "麓井", brewery: "麓井酒造", location: "山形縣" },
  { brand: "花泉", brewery: "花泉酒造", location: "福島縣" },
  { brand: "英勲", brewery: "齊藤酒造", location: "京都府" },
  { brand: "澤乃井", brewery: "小澤酒造", location: "東京都" },
  { brand: "遊穂", brewery: "御祖酒造", location: "石川縣" },
  { brand: "five（五）", brewery: "酒井酒造", location: "山口縣" },
  { brand: "相模灘", brewery: "久保田酒造", location: "神奈川縣" },
  { brand: "S.tokyo", brewery: "中沢酒造", location: "神奈川縣" },
  { brand: "菊正宗", brewery: "菊正宗酒造", location: "兵庫縣" },
  { brand: "雅山流", brewery: "新藤酒造店", location: "山形縣" },
  { brand: "多賀治", brewery: "十八盛酒造", location: "岡山縣" },
  { brand: "華鳩", brewery: "榎酒造", location: "廣島縣" },
  { brand: "喜楽長", brewery: "喜多酒造", location: "滋賀縣" },
  { brand: "三千盛", brewery: "三千盛", location: "岐阜縣" },
  { brand: "蒼空", brewery: "藤岡酒造", location: "京都府" },
  { brand: "勝山", brewery: "仙台伊澤家 勝山酒造", location: "宮城縣" },
  { brand: "澤の花", brewery: "伴野酒造", location: "長野縣" },
  { brand: "龍勢", brewery: "藤井酒造", location: "廣島縣" },
  { brand: "天青", brewery: "熊澤酒造", location: "神奈川縣" },
  { brand: "やまとしずく", brewery: "秋田清酒", location: "秋田縣" },
  { brand: "本金", brewery: "酒ぬのや本金酒造", location: "長野縣" },
  { brand: "千代鶴", brewery: "千代鶴酒造", location: "富山縣" },
  { brand: "白鷹", brewery: "白鷹", location: "兵庫縣" },
  { brand: "亮", brewery: "中沢酒造", location: "神奈川縣" },
  { brand: "惣誉", brewery: "惣誉酒造", location: "栃木縣" },
  { brand: "龍神丸", brewery: "高垣酒造", location: "和歌山縣" },
  { brand: "NEXT5", brewery: "秋田ネクストファイブ共同醸造酒", location: "秋田縣" },
  { brand: "天寶一", brewery: "天寶一", location: "廣島縣" },
  { brand: "吾有事", brewery: "奥羽自慢株式会社", location: "山形縣" },
  { brand: "咲耶美", brewery: "貴娘酒造", location: "群馬縣" },
  { brand: "花雪", brewery: "河津酒造", location: "熊本縣" },
  { brand: "鳩正宗", brewery: "鳩正宗", location: "青森縣" },
  { brand: "白老", brewery: "澤田酒造", location: "愛知縣" },
  { brand: "喜久泉", brewery: "西田酒造店", location: "青森縣" },
  { brand: "加賀鳶", brewery: "福光屋", location: "石川縣" },
  { brand: "天寿", brewery: "天寿酒造", location: "秋田縣" },
  { brand: "奥の松", brewery: "奥の松酒造", location: "福島縣" },
  { brand: "白隠正宗", brewery: "高嶋酒造", location: "靜岡縣" },
  { brand: "車坂", brewery: "吉村秀雄商店", location: "和歌山縣" },
  { brand: "旭興", brewery: "渡邉酒造", location: "栃木縣" },
  { brand: "末廣", brewery: "末廣酒造", location: "福島縣" },
  { brand: "勢正宗", brewery: "丸世酒造店", location: "長野縣" },
  { brand: "善知鳥", brewery: "西田酒造店", location: "青森縣" },
  { brand: "松尾自慢", brewery: "寒菊銘醸", location: "千葉縣" },
  { brand: "正雪", brewery: "神沢川酒造場", location: "靜岡縣" },
  { brand: "浪乃音", brewery: "浪乃音酒造", location: "滋賀縣" },
  { brand: "竹葉", brewery: "数馬酒造", location: "石川縣" },
  { brand: "西條鶴", brewery: "西條鶴酒造", location: "廣島縣" },
  { brand: "真野鶴", brewery: "尾畑酒造", location: "新潟縣" },
  { brand: "菊鷹", brewery: "藤市酒造", location: "愛知縣" },
  { brand: "来楽", brewery: "茨木酒造", location: "兵庫縣" },
  { brand: "VEGA", brewery: "阿部酒造", location: "新潟縣" },
  { brand: "一滴二滴", brewery: "志賀泉酒造", location: "長野縣" },
  { brand: "男山", brewery: "男山", location: "北海道" },
  { brand: "るみ子の酒", brewery: "森喜酒造場", location: "三重縣" },
  { brand: "越乃景虎", brewery: "諸橋酒造", location: "新潟縣" },
  { brand: "秀よし", brewery: "鈴木酒造店", location: "秋田縣" },
  { brand: "陸奥男山", brewery: "八戸酒造", location: "青森縣" },
  { brand: "奥丹波", brewery: "山名酒造", location: "兵庫縣" },
  { brand: "巻機", brewery: "高千代酒造", location: "新潟縣" },
  { brand: "善吉", brewery: "中善酒造店", location: "長野縣" },
  { brand: "松の寿", brewery: "松井酒造店", location: "栃木縣" },
  { brand: "山和", brewery: "山和酒造店", location: "宮城縣" },
  { brand: "山に雲が", brewery: "川澤酒造", location: "高知縣" },
  { brand: "東光", brewery: "小嶋総本店", location: "山形縣" },
  { brand: "誠鏡", brewery: "中尾醸造", location: "廣島縣" },
  { brand: "喜久酔", brewery: "青島酒造", location: "靜岡縣" },
  { brand: "九尾", brewery: "天鷹酒造", location: "栃木縣" },
  { brand: "浅間嶽", brewery: "大塚酒造", location: "長野縣" },
  { brand: "玉乃光", brewery: "玉乃光酒造", location: "京都府" },
  { brand: "帝松", brewery: "松岡醸造", location: "埼玉縣" },
  { brand: "谷川岳", brewery: "永井酒造", location: "群馬縣" },
  { brand: "開華", brewery: "第一酒造", location: "栃木縣" },
  { brand: "奥", brewery: "山崎合資", location: "愛知縣" },
  { brand: "あぶくま", brewery: "玄葉本店", location: "福島縣" },
  { brand: "霧筑波", brewery: "浦里酒造店", location: "茨城縣" },
  { brand: "雪彦山", brewery: "壺坂酒造", location: "兵庫縣" },
  { brand: "十石", brewery: "松山酒造", location: "京都府" },
  { brand: "智則", brewery: "吉田酒造", location: "島根縣" },
  { brand: "百黙", brewery: "菊正宗酒造", location: "兵庫縣" },
  { brand: "綿屋", brewery: "金の井酒造", location: "宮城縣" },
  { brand: "李白", brewery: "李白酒造", location: "島根縣" },
  { brand: "渓流", brewery: "遠藤酒造場", location: "長野縣" },
  { brand: "十水", brewery: "加藤嘉八郎酒造", location: "山形縣" },
  { brand: "無想", brewery: "大洋酒造", location: "新潟縣" },
  { brand: "弥栄鶴", brewery: "竹野酒造", location: "京都府" },
  { brand: "醴泉", brewery: "玉泉堂酒造", location: "岐阜縣" },
  { brand: "日置桜", brewery: "山根酒造場", location: "鳥取縣" },
  { brand: "雨垂れ石を穿つ", brewery: "福井弥平商店", location: "滋賀縣" },
  { brand: "三好", brewery: "阿武の鶴酒造", location: "山口縣" },
  { brand: "賀茂鶴", brewery: "賀茂鶴酒造", location: "廣島縣" },
  { brand: "美酒の設計", brewery: "齋彌酒造店", location: "秋田縣" },
  { brand: "豊能梅", brewery: "高木酒造", location: "高知縣" },
  { brand: "仁勇", brewery: "鍋店", location: "千葉縣" },
  { brand: "帰山", brewery: "千曲錦酒造", location: "長野縣" },
  { brand: "盛典", brewery: "岡田本家", location: "兵庫縣" },
  { brand: "奥六", brewery: "岩手銘醸", location: "岩手縣" },
  { brand: "THE SAZANAMI", brewery: "阿部酒造", location: "新潟縣" },
  { brand: "月桂冠", brewery: "月桂冠", location: "京都府" },
  { brand: "白鶴", brewery: "白鶴酒造", location: "兵庫縣" },
  { brand: "群馬泉", brewery: "島岡酒造", location: "群馬縣" }
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

export function inferOriginFromSakeInfo(
  brandName: string,
  brewery: string,
  knownBrands: Array<{ brandName: string; brewery: string; origin?: string }> = []
): string {
  const cleanedBrandName = cleanSakeName(brandName);
  const cleanedBrewery = cleanSakeName(brewery);

  const norm = (s: string) =>
    s.toLowerCase().replace(/[\s\u3000・·･]/g, '').replace(/[（(][^）)]*[）)]/g, '');
  const buildBrandKeys = (s: string) => {
    const cleaned = cleanSakeName(s);
    const parts = cleaned.split(/[\s\u3000\/]+/).map(norm).filter(Boolean);
    return new Set([norm(cleaned), ...parts]);
  };

  const brandKeys = buildBrandKeys(cleanedBrandName);
  const normalizedBrewery = norm(cleanedBrewery);

  for (const known of knownBrands) {
    const knownBrewery = norm(known.brewery || '');
    if (known.origin && normalizedBrewery.length >= 2 && normalizedBrewery === knownBrewery) {
      return known.origin;
    }

    const knownBrandKeys = buildBrandKeys(known.brandName || '');
    const brandMatch = [...knownBrandKeys].some((key) => key.length >= 2 && brandKeys.has(key));
    if (known.origin && brandMatch) {
      return known.origin;
    }
  }

  for (const entry of SAKE_DATABASE) {
    const entryBrewery = norm(entry.brewery);
    if (normalizedBrewery.length >= 2 && normalizedBrewery === entryBrewery) {
      return entry.location;
    }

    const entryBrandKeys = buildBrandKeys(entry.brand);
    const brandMatch = [...entryBrandKeys].some((key) => key.length >= 2 && brandKeys.has(key));
    if (brandMatch) {
      return entry.location;
    }
  }

  return '';
}
