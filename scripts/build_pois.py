#!/usr/bin/env python3
"""
build_pois.py — 生成「周边探索」静态数据 src/data/pois.json

数据来源：OpenStreetMap（通过 Overpass API，WGS84，与项目地图坐标系一致）。
仅使用开放数据，构建期一次性抓取，前端运行时零外网依赖。

用法：
    python scripts/build_pois.py            # 构建精选站点（默认，演示用，稳定）
    python scripts/build_pois.py --all      # 构建全部已知坐标站点（较慢）

说明：
- 餐饮：amenity = restaurant | cafe | fast_food
- 景点：tourism = attraction | museum | viewpoint | gallery | artwork
                  | theme_park | zoo | aquarium
- 每个站点保留半径内最多 TOP_N 个 POI（按推荐分降序）。
- 推荐分为「客观信号」合成（信息完整度 + 距离），不是虚构评分。
"""

import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COORDS_TS = os.path.join(ROOT, "src", "data", "stationCoordinates.ts")
OUT_JSON = os.path.join(ROOT, "src", "data", "pois.json")

RADIUS_M = 800          # 抓取半径
ATTACH_RADIUS_M = 800   # 归站半径
TOP_N = 40              # 每站保留上限
WALK_M_PER_MIN = 80     # 步行速度（米/分钟）

OVERPASS_ENDPOINTS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# 演示用精选站点（旅游/美食密集，保证每次点击都有丰富内容）
CURATED = [
    "1", "2", "26", "27", "28", "31", "33",          # 港岛
    "3", "80", "4", "5", "6", "16", "65", "64",       # 尖沙咀/油尖旺/红磡
    "8", "40", "53", "17", "15", "11", "91",          # 九龙
    "68", "67", "25", "116", "120",                   # 新界
    "43", "86", "50",                                 # 东涌/海洋公园/将军澳
]

FOOD_AMENITIES = {"restaurant", "cafe", "fast_food"}
TOURISM_KINDS = {
    "attraction", "museum", "viewpoint", "gallery", "artwork",
    "theme_park", "zoo", "aquarium",
}

# cuisine 原始 token -> 归一化 key（前端 cuisineMap.ts 负责本地化与配色）
CUISINE_ALIAS = {
    "chinese": "chinese", "cantonese": "chinese", "dim_sum": "dimsum",
    "dimsum": "dimsum", "hong_kong": "chinese", "shanghainese": "chinese",
    "sichuan": "chinese", "szechuan": "chinese", "hotpot": "hotpot",
    "hot_pot": "hotpot", "noodle": "noodle", "noodles": "noodle",
    "ramen": "ramen", "sushi": "sushi", "japanese": "japanese",
    "korean": "korean", "thai": "thai", "vietnamese": "vietnamese",
    "indian": "indian", "italian": "italian", "pizza": "pizza",
    "french": "french", "western": "western", "american": "american",
    "burger": "burger", "steak_house": "steak", "steak": "steak",
    "seafood": "seafood", "vegetarian": "vegetarian", "vegan": "vegetarian",
    "coffee_shop": "cafe", "cafe": "cafe", "coffee": "cafe",
    "dessert": "dessert", "ice_cream": "dessert", "bakery": "bakery",
    "tea": "tea", "bubble_tea": "tea", "asian": "asian",
    "international": "international", "fast_food": "fastfood",
    "chicken": "fastfood", "sandwich": "cafe", "breakfast": "cafe",
    "barbecue": "bbq", "bbq": "bbq",
}


def parse_station_coords():
    txt = open(COORDS_TS, "r", encoding="utf-8").read()
    coords = {}
    for m in re.finditer(
        r'"(\d+)"\s*:\s*\{\s*lat:\s*([\d.]+)\s*,\s*lng:\s*([\d.]+)', txt
    ):
        coords[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    return coords


def haversine(a_lat, a_lng, b_lat, b_lng):
    R = 6371000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def overpass(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    last_err = None
    for ep in OVERPASS_ENDPOINTS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    ep, data=data,
                    headers={"User-Agent": "MTR-HCI-coursework/1.0 (poi builder)"},
                )
                with urllib.request.urlopen(req, timeout=60) as resp:
                    raw = resp.read().decode("utf-8", "replace")
                if raw.lstrip().startswith("{"):
                    return json.loads(raw)
                last_err = "non-json response"
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
            time.sleep(1.5)
    raise RuntimeError(f"all overpass endpoints failed: {last_err}")


def build_query(lat, lng, r):
    return (
        "[out:json][timeout:40];("
        f'nwr["amenity"~"^(restaurant|cafe|fast_food)$"](around:{r},{lat},{lng});'
        f'nwr["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|'
        f'theme_park|zoo|aquarium)$"](around:{r},{lat},{lng});'
        ");out tags center;"
    )


def el_coord(el):
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    c = el.get("center")
    if c:
        return c["lat"], c["lon"]
    return None


def normalize_cuisine(tags):
    raw = tags.get("cuisine", "")
    if raw:
        first = raw.split(";")[0].strip().lower()
        if first in CUISINE_ALIAS:
            return CUISINE_ALIAS[first]
    amenity = tags.get("amenity", "")
    if amenity == "cafe":
        return "cafe"
    if amenity == "fast_food":
        return "fastfood"
    return ""


def make_poi(el):
    coord = el_coord(el)
    if not coord:
        return None
    tags = el.get("tags", {})
    name = tags.get("name") or tags.get("name:zh") or tags.get("name:en")
    if not name:
        return None  # 丢弃无名 POI

    amenity = tags.get("amenity", "")
    tourism = tags.get("tourism", "")
    if amenity in FOOD_AMENITIES:
        ptype = "food"
        kind = amenity
    elif tourism in TOURISM_KINDS:
        ptype = "attraction"
        kind = tourism
    else:
        return None

    website = (
        tags.get("website")
        or tags.get("contact:website")
        or tags.get("url")
        or ""
    )
    phone = tags.get("phone") or tags.get("contact:phone") or ""
    hours = tags.get("opening_hours", "")
    name_en = tags.get("name:en", "")
    name_zh = tags.get("name:zh") or tags.get("name:zh-Hant") or ""

    return {
        "id": f"{el['type'][0]}{el['id']}",
        "type": ptype,
        "kind": kind,
        "name": {"default": name, "en": name_en, "zh": name_zh},
        "cuisineKey": normalize_cuisine(tags) if ptype == "food" else "",
        "lat": round(coord[0], 6),
        "lng": round(coord[1], 6),
        "website": website,
        "phone": phone,
        "opening_hours": hours,
    }


def info_score(p):
    s = 0
    if p["cuisineKey"]:
        s += 5
    if p["website"]:
        s += 4
    if p["opening_hours"]:
        s += 4
    if p["phone"]:
        s += 2
    if p["name"]["en"]:
        s += 2
    if p["name"]["zh"]:
        s += 2
    return s


def main():
    coords = parse_station_coords()
    do_all = "--all" in sys.argv
    targets = list(coords.keys()) if do_all else [s for s in CURATED if s in coords]
    print(f"building POIs for {len(targets)} stations "
          f"({'ALL' if do_all else 'curated'})")

    # 1) 抓取每个站点周边原始 POI，按 id 去重缓存
    cache = {}  # poi id -> poi dict
    raw_by_station = {}  # station -> list of poi ids fetched in its radius
    for i, sid in enumerate(targets, 1):
        lat, lng = coords[sid]
        try:
            res = overpass(build_query(lat, lng, RADIUS_M))
        except Exception as e:  # noqa: BLE001
            print(f"  [{i}/{len(targets)}] station {sid}: FETCH FAILED ({e})")
            raw_by_station[sid] = []
            continue
        ids = []
        for el in res.get("elements", []):
            poi = make_poi(el)
            if not poi:
                continue
            cache[poi["id"]] = poi
            ids.append(poi["id"])
        raw_by_station[sid] = ids
        print(f"  [{i}/{len(targets)}] station {sid}: {len(ids)} pois")
        time.sleep(0.6)

    # 2) 归站 + 距离 + 推荐分 + 截断
    out = {}
    for sid in targets:
        lat, lng = coords[sid]
        seen = set()
        rows = []
        for pid in raw_by_station.get(sid, []):
            p = cache[pid]
            dist = haversine(lat, lng, p["lat"], p["lng"])
            if dist > ATTACH_RADIUS_M:
                continue
            dedup_key = (p["name"]["default"], round(p["lat"], 4), round(p["lng"], 4))
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            walk = max(1, round(dist / WALK_M_PER_MIN))
            score = info_score(p) + max(0.0, 25.0 - dist / 24.0)
            rows.append({
                "id": p["id"],
                "type": p["type"],
                "kind": p["kind"],
                "name": p["name"],
                "cuisineKey": p["cuisineKey"],
                "lat": p["lat"],
                "lng": p["lng"],
                "distanceM": round(dist),
                "walkMin": walk,
                "score": round(score, 1),
                "featured": False,
                "website": p["website"],
                "phone": p["phone"],
                "openingHours": p["opening_hours"],
            })
        rows.sort(key=lambda r: (-r["score"], r["distanceM"]))
        if rows:  # 不输出空站，避免前端出现"亮光环却无内容"的不一致
            out[sid] = rows[:TOP_N]

    total = sum(len(v) for v in out.values())
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT_JSON}: {len(out)} stations, {total} pois total")


if __name__ == "__main__":
    main()
