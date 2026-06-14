#!/usr/bin/env python3
"""
fetch_apify.py — 用 Apify「Google Maps Scraper」为指定站点补充真实美食数据

策略(经验证后定稿)：
- OSM 餐厅 与 Google 餐厅基本是两套不同的店,无法靠名称匹配。
- 因此「被抓取的站点」其美食列表**直接用 Google 的店**(自带 ⭐评分 / 评论数 / 价位 / 照片),
  景点(attraction)继续保留 OSM/Wikimedia 富集成果。
- 已有维基简介的名店,若与某 Google 店同名,则把简介 + Wikimedia 图「认领」过去(名店不丢简介)。
- 主图经本地 Clash 代理下载到 public/poi/,运行时零外网依赖。

前置：
- token.env 含 Apify token。
- 图片下载需走代理:运行前
    $env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897"

用法：
    python scripts/fetch_apify.py 3            # 只跑尖沙咀(验证)
    python scripts/fetch_apify.py --core       # 核心 ~30 站
    python scripts/fetch_apify.py 3 6 28 --cap 40
"""

import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POIS_JSON = os.path.join(ROOT, "src", "data", "pois.json")
COORDS_TS = os.path.join(ROOT, "src", "data", "stationCoordinates.ts")
IMG_DIR = os.path.join(ROOT, "public", "poi")
IMG_PREFIX = "poi"
ACTOR = "compass~crawler-google-places"
UA = "Mozilla/5.0 (MTR-HCI-coursework)"
TOP_N = 40
WALK_M_PER_MIN = 80
MAX_RADIUS_M = 900

CORE = [
    "1", "2", "26", "27", "28", "31", "33",
    "3", "4", "5", "6", "16", "64", "40", "8", "17", "15", "11", "91", "10",
    "68", "67", "25", "116", "120", "50", "43", "86",
]

# --rest 模式的优先顺序:剩余核心站 → 市区热门 → 新界/外围(钱用光前先抓重要的)
PRIORITY = [
    "10", "91", "68", "67", "25", "116", "120", "50", "43", "86",
    "65", "80", "85", "84", "53", "41", "32", "34", "35", "30", "29",
    "9", "12", "13", "14", "7", "18", "19", "20", "48", "38", "49",
    "22", "23", "87", "89", "88", "81", "82", "83", "36", "37", "24", "21",
    "69", "71", "72", "73", "74", "75", "76", "78", "90", "92", "93",
    "96", "97", "98", "99", "100", "101", "102", "103", "111", "114", "115",
    "117", "118", "119", "51", "52", "57", "54", "55", "42", "39", "47", "56", "94",
]

CUISINE_RULES = [
    ("dim sum", "dimsum"), ("dai pai dong", "chinese"), ("hot pot", "hotpot"),
    ("hotpot", "hotpot"), ("ramen", "ramen"), ("sushi", "sushi"),
    ("japanese", "japanese"), ("korean", "korean"), ("thai", "thai"),
    ("vietnamese", "vietnamese"), ("indian", "indian"), ("pizza", "pizza"),
    ("italian", "italian"), ("french", "french"), ("seafood", "seafood"),
    ("steak", "steak"), ("vegetarian", "vegetarian"), ("vegan", "vegetarian"),
    ("coffee", "cafe"), ("cafe", "cafe"), ("café", "cafe"),
    ("dessert", "dessert"), ("ice cream", "dessert"), ("bakery", "bakery"),
    ("bubble tea", "tea"), ("tea", "tea"), ("burger", "burger"),
    ("fast food", "fastfood"), ("cantonese", "chinese"), ("chinese", "chinese"),
    ("hong kong", "chinese"), ("noodle", "noodle"), ("bbq", "bbq"),
    ("barbecue", "bbq"), ("mexican", "western"), ("american", "western"),
    ("western", "western"), ("european", "western"), ("french", "french"),
]


def load_token():
    raw = open(os.path.join(ROOT, "token.env"), encoding="utf-8").read()
    for line in raw.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        return (s.split("=", 1)[1] if "=" in s else s).strip().strip('"').strip("'")
    raise SystemExit("token.env 为空")


def parse_coords():
    txt = open(COORDS_TS, encoding="utf-8").read()
    out = {}
    for m in re.finditer(r'"(\d+)"\s*:\s*\{\s*lat:\s*([\d.]+)\s*,\s*lng:\s*([\d.]+)', txt):
        out[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    return out


def haversine(a, b, c, d):
    R = 6371000.0
    p1, p2 = math.radians(a), math.radians(c)
    dphi = math.radians(c - a)
    dl = math.radians(d - b)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def norm(s):
    return re.sub(r"[^0-9a-z一-鿿]+", "", (s or "").lower())


def cjk_part(s):
    runs = re.findall(r"[一-鿿·]+", s or "")
    return max(runs, key=len) if runs else ""


def latin_part(s):
    runs = re.findall(r"[A-Za-z0-9][A-Za-z0-9 &',.\-()]*", s or "")
    return max(runs, key=len).strip() if runs else ""


def category_to_cuisine(cat):
    c = (cat or "").lower()
    for kw, key in CUISINE_RULES:
        if kw in c:
            return key
    return ""


def apify_scrape(token, lat, lng, cap):
    url = f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items?token={token}"
    payload = {
        "searchStringsArray": ["restaurant"],
        "customGeolocation": {"type": "Point", "coordinates": [lng, lat], "radiusKm": 0.9},
        "maxCrawledPlacesPerSearch": cap,
        "language": "en",
        "maxReviews": 0,
        "maxImages": 0,
        "maxQuestions": 0,
        "scrapeContacts": False,
        "skipClosedPlaces": True,
    }
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=590) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def download_image(url, poi_id):
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    fname = re.sub(r"[^A-Za-z0-9_-]", "", poi_id) + ext
    dest = os.path.join(IMG_DIR, fname)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as resp:
        blob = resp.read()
    if len(blob) < 512:
        raise RuntimeError("image too small")
    os.makedirs(IMG_DIR, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(blob)
    return f"{IMG_PREFIX}/{fname}"


def build_wiki_index(old_food):
    """已有维基简介/图片的老店,按名称建索引,供 Google 店认领。"""
    idx = []
    for p in old_food:
        if p.get("description") or p.get("image"):
            variants = {norm(p["name"].get("default")), norm(p["name"].get("en")), norm(p["name"].get("zh"))}
            variants.discard("")
            idx.append((variants, p))
    return idx


def claim_wiki(title, idx):
    nt = norm(title)
    if not nt:
        return None
    for variants, p in idx:
        for v in variants:
            if v and (v == nt or (len(v) >= 3 and (v in nt or nt in v))):
                return p
    return None


def google_to_poi(g, slat, slng, wiki_idx, downloaded):
    gl = g.get("location") or {}
    if "lat" not in gl or "lng" not in gl:
        return None
    dist = haversine(slat, slng, gl["lat"], gl["lng"])
    if dist > MAX_RADIUS_M:
        return None
    title = (g.get("title") or "").strip()
    if not title:
        return None
    pid = "g" + re.sub(r"[^A-Za-z0-9]", "", str(g.get("placeId") or g.get("fid") or title))[:24]
    rating = g.get("totalScore")
    reviews = g.get("reviewsCount") or 0
    zh = cjk_part(title)
    en = latin_part(title)
    poi = {
        "id": pid,
        "type": "food",
        "kind": "restaurant",
        "name": {"default": title, "en": en or title, "zh": zh},
        "cuisineKey": category_to_cuisine(g.get("categoryName")),
        "lat": round(gl["lat"], 6),
        "lng": round(gl["lng"], 6),
        "distanceM": round(dist),
        "walkMin": max(1, round(dist / WALK_M_PER_MIN)),
        # recommend 分:评分加权 + 评论加成 + 距离衰减
        "score": round((rating or 3.5) * 8 + min(reviews / 50.0, 30) - dist / 60.0, 1),
        "featured": bool(rating and rating >= 4.6 and reviews >= 300),
        "website": g.get("website") or "",
        "phone": g.get("phone") or "",
        "openingHours": "",
    }
    if rating is not None:
        poi["rating"] = rating
        poi["reviewsCount"] = reviews
    if g.get("price"):
        poi["price"] = g["price"]

    # 认领维基简介 / Wikimedia 图(名店保住)
    claimed = claim_wiki(title, wiki_idx)
    used_wiki_img = False
    if claimed:
        if claimed.get("description"):
            poi["description"] = claimed["description"]
        if claimed.get("wikipediaUrl"):
            poi["wikipediaUrl"] = claimed["wikipediaUrl"]
        # Wikimedia(CC)图优先于 Google 图
        if claimed.get("image") and "commons" in (claimed.get("imageSource", "") or ""):
            poi["image"] = claimed["image"]
            poi["imageCredit"] = claimed.get("imageCredit", "")
            poi["imageSource"] = claimed.get("imageSource", "")
            used_wiki_img = True

    # 否则下载 Google 主图
    if not used_wiki_img and g.get("imageUrl"):
        if pid in downloaded:
            poi.update(downloaded[pid])
        else:
            try:
                path = download_image(g["imageUrl"], pid)
                fields = {
                    "image": path,
                    "imageCredit": "Google Maps",
                    "imageSource": g.get("url", ""),
                }
                downloaded[pid] = fields
                poi.update(fields)
            except Exception as e:  # noqa: BLE001
                print(f"    img dl failed {pid}: {e}")
    return poi


def main():
    argv = sys.argv[1:]
    cap = 40
    budget = 100000  # 全局抓取上限(家),防超支
    args = []
    flags = set()
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--cap":
            cap = int(argv[i + 1]); i += 2; continue
        if a == "--budget":
            budget = int(argv[i + 1]); i += 2; continue
        if a.startswith("--"):
            flags.add(a); i += 1; continue
        args.append(a); i += 1

    token = load_token()
    coords = parse_coords()
    data = json.load(open(POIS_JSON, encoding="utf-8"))

    if "--rest" in flags:
        have = {k for k, v in data.items()
                if any(p.get("id", "").startswith("g") for p in v if p["type"] == "food")}
        remaining = [k for k in data.keys() if k not in have]
        targets = ([s for s in PRIORITY if s in remaining]
                   + sorted([s for s in remaining if s not in PRIORITY], key=int))
    elif "--core" in flags:
        targets = CORE
    else:
        targets = args or ["3"]

    print(f"proxy HTTP_PROXY={os.environ.get('HTTP_PROXY', '(none)')}")
    print(f"targets: {targets} | cap/station={cap}")

    downloaded = {}
    scraped_total = 0
    consec_402 = 0
    for sid in targets:
        if scraped_total >= budget:
            print(f"已达预算上限 {budget} 家,停止(已抓 {scraped_total})")
            break
        if sid not in data or sid not in coords:
            print(f"station {sid}: 跳过(无数据/坐标)")
            continue
        if any(p.get("id", "").startswith("g") for p in data[sid] if p["type"] == "food"):
            print(f"station {sid}: 已有 Google 数据,跳过(不重复抓取)")
            continue
        slat, slng = coords[sid]
        try:
            items = apify_scrape(token, slat, slng, cap)
            consec_402 = 0
        except Exception as e:  # noqa: BLE001
            print(f"station {sid}: SCRAPE FAILED {e}")
            if "402" in str(e):
                consec_402 += 1
                if consec_402 >= 3:
                    print("额度已耗尽(连续 402),停止")
                    break
            continue
        scraped_total += len(items)

        old_rows = data[sid]
        old_food = [p for p in old_rows if p["type"] == "food"]
        attractions = [p for p in old_rows if p["type"] != "food"]
        wiki_idx = build_wiki_index(old_food)

        new_food = []
        seen = set()
        for g in items:
            poi = google_to_poi(g, slat, slng, wiki_idx, downloaded)
            if not poi or poi["id"] in seen:
                continue
            seen.add(poi["id"])
            new_food.append(poi)
        new_food.sort(key=lambda r: (-r["score"], r["distanceM"]))

        # 美食用 Google,景点保留;合并后按推荐分截断
        merged = (new_food + attractions)
        merged.sort(key=lambda r: (-r["score"], r["distanceM"]))
        data[sid] = merged[:TOP_N]
        n_rate = sum(1 for p in new_food if p.get("rating") is not None)
        n_img = sum(1 for p in new_food if p.get("image"))
        print(f"station {sid}: scraped {len(items)} -> {len(new_food)} food "
              f"(rated {n_rate}, img {n_img}) + {len(attractions)} attractions")

    with open(POIS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nDONE: scraped {scraped_total} google places ≈ ${scraped_total * 0.004:.2f}")


if __name__ == "__main__":
    main()
