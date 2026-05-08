/**
 * MTR 重铁车站经纬度坐标数据
 * Station ID -> { lat, lng }
 * 来源: 公开资料 (Wikipedia / OpenStreetMap)
 * Key = Station ID from mtr_lines_and_stations.csv
 */
export const stationCoordinates: Record<string, { lat: number; lng: number }> = {
  // ===== Island Line 港岛线 =====
  "1":  { lat: 22.2819, lng: 114.1583 },  // Central 中環
  "2":  { lat: 22.2791, lng: 114.1654 },  // Admiralty 金鐘
  "26": { lat: 22.2866, lng: 114.1521 },  // Sheung Wan 上環
  "27": { lat: 22.2776, lng: 114.1731 },  // Wan Chai 灣仔
  "28": { lat: 22.2801, lng: 114.1840 },  // Causeway Bay 銅鑼灣
  "29": { lat: 22.2825, lng: 114.1917 },  // Tin Hau 天后
  "30": { lat: 22.2876, lng: 114.1939 },  // Fortress Hill 炮台山
  "31": { lat: 22.2914, lng: 114.2009 },  // North Point 北角
  "32": { lat: 22.2882, lng: 114.2095 },  // Quarry Bay 鰂魚涌
  "33": { lat: 22.2845, lng: 114.2167 },  // Tai Koo 太古
  "34": { lat: 22.2817, lng: 114.2228 },  // Sai Wan Ho 西灣河
  "35": { lat: 22.2790, lng: 114.2287 },  // Shau Kei Wan 筲箕灣
  "36": { lat: 22.2765, lng: 114.2398 },  // Heng Fa Chuen 杏花邨
  "37": { lat: 22.2644, lng: 114.2370 },  // Chai Wan 柴灣
  "81": { lat: 22.2855, lng: 114.1427 },  // Sai Ying Pun 西營盤
  "82": { lat: 22.2839, lng: 114.1350 },  // HKU 香港大學
  "83": { lat: 22.2813, lng: 114.1286 },  // Kennedy Town 堅尼地城

  // ===== Kwun Tong Line 觀塘綫 =====
  "3":  { lat: 22.2973, lng: 114.1722 },  // Tsim Sha Tsui 尖沙咀
  "4":  { lat: 22.3050, lng: 114.1716 },  // Jordan 佐敦
  "5":  { lat: 22.3131, lng: 114.1706 },  // Yau Ma Tei 油麻地
  "6":  { lat: 22.3193, lng: 114.1694 },  // Mong Kok 旺角
  "7":  { lat: 22.3318, lng: 114.1686 },  // Shek Kip Mei 石硤尾
  "8":  { lat: 22.3369, lng: 114.1757 },  // Kowloon Tong 九龍塘
  "9":  { lat: 22.3381, lng: 114.1870 },  // Lok Fu 樂富
  "10": { lat: 22.3416, lng: 114.1936 },  // Wong Tai Sin 黃大仙
  "11": { lat: 22.3404, lng: 114.2013 },  // Diamond Hill 鑽石山
  "12": { lat: 22.3351, lng: 114.2089 },  // Choi Hung 彩虹
  "13": { lat: 22.3233, lng: 114.2135 },  // Kowloon Bay 九龍灣
  "14": { lat: 22.3155, lng: 114.2191 },  // Ngau Tau Kok 牛頭角
  "15": { lat: 22.3123, lng: 114.2260 },  // Kwun Tong 觀塘
  "16": { lat: 22.3243, lng: 114.1685 },  // Prince Edward 太子
  "38": { lat: 22.3066, lng: 114.2324 },  // Lam Tin 藍田
  "48": { lat: 22.2979, lng: 114.2369 },  // Yau Tong 油塘
  "49": { lat: 22.3045, lng: 114.2527 },  // Tiu Keng Leng 調景嶺
  "84": { lat: 22.3095, lng: 114.1830 },  // Ho Man Tin 何文田
  "85": { lat: 22.3049, lng: 114.1896 },  // Whampoa 黃埔

  // ===== Tsuen Wan Line 荃灣綫 =====
  "17": { lat: 22.3306, lng: 114.1628 },  // Sham Shui Po 深水埗
  "18": { lat: 22.3363, lng: 114.1561 },  // Cheung Sha Wan 長沙灣
  "19": { lat: 22.3372, lng: 114.1483 },  // Lai Chi Kok 茘枝角
  "20": { lat: 22.3375, lng: 114.1375 },  // Mei Foo 美孚
  "21": { lat: 22.3484, lng: 114.1261 },  // Lai King 茘景
  "22": { lat: 22.3572, lng: 114.1279 },  // Kwai Fong 葵芳
  "23": { lat: 22.3632, lng: 114.1312 },  // Kwai Hing 葵興
  "24": { lat: 22.3708, lng: 114.1251 },  // Tai Wo Hau 大窩口
  "25": { lat: 22.3734, lng: 114.1178 },  // Tsuen Wan 荃灣

  // ===== Tung Chung Line 東涌綫 =====
  "39": { lat: 22.2853, lng: 114.1585 },  // Hong Kong 香港
  "40": { lat: 22.3047, lng: 114.1614 },  // Kowloon 九龍
  "41": { lat: 22.3178, lng: 114.1604 },  // Olympic 奧運
  "43": { lat: 22.2893, lng: 113.9416 },  // Tung Chung 東涌
  "53": { lat: 22.3267, lng: 114.1536 },  // Nam Cheong 南昌
  "54": { lat: 22.3315, lng: 114.0292 },  // Sunny Bay 欣澳
  "42": { lat: 22.3585, lng: 114.1079 },  // Tsing Yi 青衣

  // ===== Airport Express 機場快綫 =====
  "47": { lat: 22.3159, lng: 113.9368 },  // Airport 機場
  "56": { lat: 22.3223, lng: 113.9417 },  // AsiaWorld-Expo 博覽館
  // Stations 39 (Hong Kong), 40 (Kowloon), 42 (Tsing Yi) shared above

  // ===== Disneyland Resort Line 迪士尼綫 =====
  "55": { lat: 22.3133, lng: 114.0445 },  // Disneyland Resort 迪士尼
  // Station 54 (Sunny Bay) shared above

  // ===== Tseung Kwan O Line 將軍澳綫 =====
  "50": { lat: 22.3073, lng: 114.2601 },  // Tseung Kwan O 將軍澳
  "51": { lat: 22.3155, lng: 114.2642 },  // Hang Hau 坑口
  "52": { lat: 22.3226, lng: 114.2581 },  // Po Lam 寶琳
  "57": { lat: 22.2955, lng: 114.2694 },  // LOHAS Park 康城
  // Stations 48, 49, 31, 32 shared above

  // ===== East Rail Line 東鐵綫 =====
  "64": { lat: 22.3032, lng: 114.1815 },  // Hung Hom 紅磡
  "65": { lat: 22.3218, lng: 114.1726 },  // Mong Kok East 旺角東
  "67": { lat: 22.3731, lng: 114.1785 },  // Tai Wai 大圍
  "68": { lat: 22.3817, lng: 114.1875 },  // Sha Tin 沙田
  "69": { lat: 22.3953, lng: 114.1984 },  // Fo Tan 火炭
  "71": { lat: 22.4133, lng: 114.2098 },  // University 大學
  "72": { lat: 22.4445, lng: 114.1706 },  // Tai Po Market 大埔墟
  "73": { lat: 22.4508, lng: 114.1613 },  // Tai Wo 太和
  "74": { lat: 22.4920, lng: 114.1383 },  // Fanling 粉嶺
  "75": { lat: 22.5013, lng: 114.1280 },  // Sheung Shui 上水
  "76": { lat: 22.5284, lng: 114.1136 },  // Lo Wu 羅湖
  "78": { lat: 22.5148, lng: 114.0789 },  // Lok Ma Chau 落馬洲
  "94": { lat: 22.2825, lng: 114.1751 },  // Exhibition Centre 會展

  // ===== Tuen Ma Line 屯馬綫 =====
  "80":  { lat: 22.2950, lng: 114.1748 },  // East Tsim Sha Tsui 尖東
  "90":  { lat: 22.3647, lng: 114.1722 },  // Hin Keng 顯徑
  "91":  { lat: 22.3305, lng: 114.1990 },  // Kai Tak 啟德
  "92":  { lat: 22.3258, lng: 114.1887 },  // Sung Wong Toi 宋皇臺
  "93":  { lat: 22.3168, lng: 114.1875 },  // To Kwa Wan 土瓜灣
  "96":  { lat: 22.3748, lng: 114.1862 },  // Che Kung Temple 車公廟
  "97":  { lat: 22.3762, lng: 114.1950 },  // Sha Tin Wai 沙田圍
  "98":  { lat: 22.3828, lng: 114.2031 },  // City One 第一城
  "99":  { lat: 22.3876, lng: 114.2082 },  // Shek Mun 石門
  "100": { lat: 22.4088, lng: 114.2226 },  // Tai Shui Hang 大水坑
  "101": { lat: 22.4177, lng: 114.2257 },  // Heng On 恆安
  "102": { lat: 22.4251, lng: 114.2318 },  // Ma On Shan 馬鞍山
  "103": { lat: 22.4291, lng: 114.2431 },  // Wu Kai Sha 烏溪沙
  "111": { lat: 22.3043, lng: 114.1667 },  // Austin 柯士甸
  "114": { lat: 22.3688, lng: 114.1105 },  // Tsuen Wan West 荃灣西
  "115": { lat: 22.4346, lng: 114.0635 },  // Kam Sheung Road 錦上路
  "116": { lat: 22.4461, lng: 114.0345 },  // Yuen Long 元朗
  "117": { lat: 22.4485, lng: 114.0255 },  // Long Ping 朗屏
  "118": { lat: 22.4466, lng: 114.0036 },  // Tin Shui Wai 天水圍
  "119": { lat: 22.4117, lng: 113.9787 },  // Siu Hong 兆康
  "120": { lat: 22.3949, lng: 113.9733 },  // Tuen Mun 屯門

  // ===== South Island Line 南島綫 =====
  "86": { lat: 22.2488, lng: 114.1742 },  // Ocean Park 海洋公園
  "87": { lat: 22.2482, lng: 114.1680 },  // Wong Chuk Hang 黃竹坑
  "88": { lat: 22.2420, lng: 114.1563 },  // Lei Tung 利東
  "89": { lat: 22.2430, lng: 114.1490 },  // South Horizons 海怡半島
};
