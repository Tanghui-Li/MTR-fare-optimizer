/**
 * MTR 线路拓扑边数据
 * 每条线由 [fromStationId, toStationId] 的边组成
 * 支线单独连接到正确的分支站点
 * 
 * 使用边列表而非站点列表，解决支线折线连接错误的问题
 */
export const lineSegments: Record<string, [string, string][]> = {
  // 機場快綫 Airport Express
  AEL: [
    ['56', '47'],  // AsiaWorld-Expo → Airport
    ['47', '42'],  // Airport → Tsing Yi
    ['42', '40'],  // Tsing Yi → Kowloon
    ['40', '39'],  // Kowloon → Hong Kong
  ],

  // 迪士尼綫 Disneyland Resort Line
  DRL: [
    ['54', '55'],  // Sunny Bay → Disneyland Resort
  ],

  // 東鐵綫 East Rail Line (含落馬洲支線)
  EAL: [
    // 主線: Lo Wu → Admiralty
    ['76', '75'],  // Lo Wu → Sheung Shui
    ['75', '74'],  // Sheung Shui → Fanling
    ['74', '73'],  // Fanling → Tai Wo
    ['73', '72'],  // Tai Wo → Tai Po Market
    ['72', '71'],  // Tai Po Market → University
    ['71', '69'],  // University → Fo Tan
    ['69', '68'],  // Fo Tan → Sha Tin
    ['68', '67'],  // Sha Tin → Tai Wai
    ['67', '8'],   // Tai Wai → Kowloon Tong
    ['8', '65'],   // Kowloon Tong → Mong Kok East
    ['65', '64'],  // Mong Kok East → Hung Hom
    ['64', '94'],  // Hung Hom → Exhibition Centre
    ['94', '2'],   // Exhibition Centre → Admiralty
    // 落馬洲支線: Lok Ma Chau → Sheung Shui
    ['78', '75'],  // Lok Ma Chau → Sheung Shui
  ],

  // 港島綫 Island Line
  ISL: [
    ['37', '36'],  // Chai Wan → Heng Fa Chuen
    ['36', '35'],  // Heng Fa Chuen → Shau Kei Wan
    ['35', '34'],  // Shau Kei Wan → Sai Wan Ho
    ['34', '33'],  // Sai Wan Ho → Tai Koo
    ['33', '32'],  // Tai Koo → Quarry Bay
    ['32', '31'],  // Quarry Bay → North Point
    ['31', '30'],  // North Point → Fortress Hill
    ['30', '29'],  // Fortress Hill → Tin Hau
    ['29', '28'],  // Tin Hau → Causeway Bay
    ['28', '27'],  // Causeway Bay → Wan Chai
    ['27', '2'],   // Wan Chai → Admiralty
    ['2', '1'],    // Admiralty → Central
    ['1', '26'],   // Central → Sheung Wan
    ['26', '81'],  // Sheung Wan → Sai Ying Pun
    ['81', '82'],  // Sai Ying Pun → HKU
    ['82', '83'],  // HKU → Kennedy Town
  ],

  // 觀塘綫 Kwun Tong Line
  KTL: [
    ['49', '48'],  // Tiu Keng Leng → Yau Tong
    ['48', '38'],  // Yau Tong → Lam Tin
    ['38', '15'],  // Lam Tin → Kwun Tong
    ['15', '14'],  // Kwun Tong → Ngau Tau Kok
    ['14', '13'],  // Ngau Tau Kok → Kowloon Bay
    ['13', '12'],  // Kowloon Bay → Choi Hung
    ['12', '11'],  // Choi Hung → Diamond Hill
    ['11', '10'],  // Diamond Hill → Wong Tai Sin
    ['10', '9'],   // Wong Tai Sin → Lok Fu
    ['9', '8'],    // Lok Fu → Kowloon Tong
    ['8', '7'],    // Kowloon Tong → Shek Kip Mei
    ['7', '16'],   // Shek Kip Mei → Prince Edward
    ['16', '6'],   // Prince Edward → Mong Kok
    ['6', '5'],    // Mong Kok → Yau Ma Tei
    ['5', '84'],   // Yau Ma Tei → Ho Man Tin
    ['84', '85'],  // Ho Man Tin → Whampoa
  ],

  // 屯馬綫 Tuen Ma Line
  TML: [
    ['103', '102'], // Wu Kai Sha → Ma On Shan
    ['102', '101'], // Ma On Shan → Heng On
    ['101', '100'], // Heng On → Tai Shui Hang
    ['100', '99'],  // Tai Shui Hang → Shek Mun
    ['99', '98'],   // Shek Mun → City One
    ['98', '97'],   // City One → Sha Tin Wai
    ['97', '96'],   // Sha Tin Wai → Che Kung Temple
    ['96', '67'],   // Che Kung Temple → Tai Wai
    ['67', '90'],   // Tai Wai → Hin Keng
    ['90', '11'],   // Hin Keng → Diamond Hill
    ['11', '91'],   // Diamond Hill → Kai Tak
    ['91', '92'],   // Kai Tak → Sung Wong Toi
    ['92', '93'],   // Sung Wong Toi → To Kwa Wan
    ['93', '84'],   // To Kwa Wan → Ho Man Tin
    ['84', '64'],   // Ho Man Tin → Hung Hom
    ['64', '80'],   // Hung Hom → East Tsim Sha Tsui
    ['80', '111'],  // East Tsim Sha Tsui → Austin
    ['111', '53'],  // Austin → Nam Cheong
    ['53', '20'],   // Nam Cheong → Mei Foo
    ['20', '114'],  // Mei Foo → Tsuen Wan West
    ['114', '115'], // Tsuen Wan West → Kam Sheung Road
    ['115', '116'], // Kam Sheung Road → Yuen Long
    ['116', '117'], // Yuen Long → Long Ping
    ['117', '118'], // Long Ping → Tin Shui Wai
    ['118', '119'], // Tin Shui Wai → Siu Hong
    ['119', '120'], // Siu Hong → Tuen Mun
  ],

  // 東涌綫 Tung Chung Line
  TCL: [
    ['43', '54'],  // Tung Chung → Sunny Bay
    ['54', '42'],  // Sunny Bay → Tsing Yi
    ['42', '21'],  // Tsing Yi → Lai King
    ['21', '53'],  // Lai King → Nam Cheong
    ['53', '41'],  // Nam Cheong → Olympic
    ['41', '40'],  // Olympic → Kowloon
    ['40', '39'],  // Kowloon → Hong Kong
  ],

  // 將軍澳綫 Tseung Kwan O Line (含康城支線)
  TKL: [
    // 主線: Po Lam → North Point
    ['52', '51'],  // Po Lam → Hang Hau
    ['51', '50'],  // Hang Hau → Tseung Kwan O
    ['50', '49'],  // Tseung Kwan O → Tiu Keng Leng
    ['49', '48'],  // Tiu Keng Leng → Yau Tong
    ['48', '32'],  // Yau Tong → Quarry Bay
    ['32', '31'],  // Quarry Bay → North Point
    // 康城支線: LOHAS Park → Tseung Kwan O
    ['57', '50'],  // LOHAS Park → Tseung Kwan O
  ],

  // 荃灣綫 Tsuen Wan Line
  TWL: [
    ['25', '24'],  // Tsuen Wan → Tai Wo Hau
    ['24', '23'],  // Tai Wo Hau → Kwai Hing
    ['23', '22'],  // Kwai Hing → Kwai Fong
    ['22', '21'],  // Kwai Fong → Lai King
    ['21', '20'],  // Lai King → Mei Foo
    ['20', '19'],  // Mei Foo → Lai Chi Kok
    ['19', '18'],  // Lai Chi Kok → Cheung Sha Wan
    ['18', '17'],  // Cheung Sha Wan → Sham Shui Po
    ['17', '16'],  // Sham Shui Po → Prince Edward
    ['16', '6'],   // Prince Edward → Mong Kok
    ['6', '5'],    // Mong Kok → Yau Ma Tei
    ['5', '4'],    // Yau Ma Tei → Jordan
    ['4', '3'],    // Jordan → Tsim Sha Tsui
    ['3', '2'],    // Tsim Sha Tsui → Admiralty
    ['2', '1'],    // Admiralty → Central
  ],

  // 南島綫 South Island Line
  SIL: [
    ['2', '86'],   // Admiralty → Ocean Park
    ['86', '87'],  // Ocean Park → Wong Chuk Hang
    ['87', '88'],  // Wong Chuk Hang → Lei Tung
    ['88', '89'],  // Lei Tung → South Horizons
  ],
};
