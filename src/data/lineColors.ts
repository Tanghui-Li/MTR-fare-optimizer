/**
 * MTR 各线路官方标识色
 * Line Code -> Hex Color
 */
export const lineColors: Record<string, string> = {
  AEL: '#007078',  // 機場快綫 Airport Express - Teal
  DRL: '#F5A0C7',  // 迪士尼綫 Disneyland Resort Line - Pink
  EAL: '#5EB6E4',  // 東鐵綫 East Rail Line - Light Blue
  ISL: '#0075C2',  // 港島綫 Island Line - Blue
  KTL: '#00A040',  // 觀塘綫 Kwun Tong Line - Green
  TML: '#9B2F1F',  // 屯馬綫 Tuen Ma Line - Brown
  TCL: '#F7943E',  // 東涌綫 Tung Chung Line - Orange
  TKL: '#7E3C93',  // 將軍澳綫 Tseung Kwan O Line - Purple
  TWL: '#E2231A',  // 荃灣綫 Tsuen Wan Line - Red
  SIL: '#CBD300',  // 南港島綫 South Island Line - Lime
};

/**
 * MTR 各线路中英文名称
 */
export const lineNames: Record<string, { zh: string; zhHans: string; en: string }> = {
  AEL: { zh: '機場快綫', zhHans: '机场快线', en: 'Airport Express' },
  DRL: { zh: '迪士尼綫', zhHans: '迪士尼线', en: 'Disneyland Resort Line' },
  EAL: { zh: '東鐵綫', zhHans: '东铁线', en: 'East Rail Line' },
  ISL: { zh: '港島綫', zhHans: '港岛线', en: 'Island Line' },
  KTL: { zh: '觀塘綫', zhHans: '观塘线', en: 'Kwun Tong Line' },
  TML: { zh: '屯馬綫', zhHans: '屯马线', en: 'Tuen Ma Line' },
  TCL: { zh: '東涌綫', zhHans: '东涌线', en: 'Tung Chung Line' },
  TKL: { zh: '將軍澳綫', zhHans: '将军澳线', en: 'Tseung Kwan O Line' },
  TWL: { zh: '荃灣綫', zhHans: '荃湾线', en: 'Tsuen Wan Line' },
  SIL: { zh: '南港島綫', zhHans: '南港岛线', en: 'South Island Line' },
};

export function getLocalizedLineName(lineCode: string, locale: 'zh-Hant' | 'en' | 'zh-Hans'): string {
  const line = lineNames[lineCode];
  if (!line) return lineCode;
  if (locale === 'en') return line.en;
  if (locale === 'zh-Hans') return line.zhHans || line.zh;
  return line.zh;
}

/**
 * MTR 巴士路线列表 (用于获取实时数据)
 */
export const mtrBusRoutes = [
  'K12', 'K14', 'K17', 'K18',
  'K51', 'K51A', 'K52', 'K52A', 'K53', 'K53S', 'K54', 'K54A',
  'K58', 'K65', 'K65A', 'K66', 'K68',
  'K73', 'K74', 'K75A', 'K75P',
  '506',
];
