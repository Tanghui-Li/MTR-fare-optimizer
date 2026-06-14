#!/usr/bin/env python3
"""
enrich_pois.py — 为 src/data/pois.json 补充「真实照片 + 真实简介」（方案 A）

数据来源（全部为版权干净、可缓存的开放内容）：
- OpenStreetMap：提供 POI 的 wikidata / wikipedia / wikimedia_commons / image 标签
- Wikidata：P18 主图文件名、跨语言维基百科条目链接、简短描述
- 维基百科 REST Summary：条目首段摘要（作为「介绍」）+ 首图
- Wikimedia Commons API：图片缩略图 URL、尺寸、作者与授权（CC/PD）

设计取舍：
- 仅富集「本体」拥有维基条目/图片的 POI（景点 + 个别名店）。
- 连锁品牌（仅有 brand:wikidata）一律跳过，避免每家分店都显示同一品牌 logo，
  保持卡片观感克制；这类店继续使用前端的 emoji 占位图。
- 图片下载到本地 public/poi/，前端运行时零外网依赖。
- 所有图片保留作者 + 授权署名，符合 CC BY-SA 等署名要求。

用法：
    python scripts/enrich_pois.py            # 富集全部可富集 POI
    python scripts/enrich_pois.py --dry-run  # 只统计可富集数量，不下载、不写入
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POIS_JSON = os.path.join(ROOT, "src", "data", "pois.json")
IMG_DIR = os.path.join(ROOT, "public", "poi")
IMG_PUBLIC_PREFIX = "poi"          # 前端用 BASE_URL + 该前缀拼路径
THUMB_WIDTH = 640                  # 下载缩略图宽度
DESC_MAX = 300                     # 简介最大字符数
UA = "MTR-HCI-coursework/1.0 (HKUST HCI course project; contact mariyakhaton616@gmail.com)"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


# ----------------------------------------------------------------------------- helpers
def http_json(url, data=None):
    req = urllib.request.Request(
        url, data=data, headers={"User-Agent": UA, "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def overpass(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for ep in OVERPASS_ENDPOINTS:
        for _ in range(2):
            try:
                req = urllib.request.Request(
                    ep, data=data, headers={"User-Agent": UA}
                )
                with urllib.request.urlopen(req, timeout=120) as resp:
                    raw = resp.read().decode("utf-8", "replace")
                if raw.lstrip().startswith("{"):
                    return json.loads(raw)
                last = "non-json"
            except Exception as e:  # noqa: BLE001
                last = str(e)
            time.sleep(2)
    raise RuntimeError(f"overpass failed: {last}")


def strip_html(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def clean_artist(artist):
    """清洗 Commons Artist 字段中的样板文字与重复。"""
    artist = re.sub(r"No machine-readable author provided\.?", "", artist or "")
    artist = re.sub(r"assumed \(based on copyright claims\)\.?", "", artist, flags=re.I)
    artist = re.sub(r"\(based on copyright claims\)\.?", "", artist, flags=re.I)
    artist = re.sub(r"\s+", " ", artist).strip(" .;,")
    n = len(artist)
    if n > 0 and n % 2 == 0 and artist[:n // 2] == artist[n // 2:]:
        artist = artist[:n // 2].strip()  # "Unknown authorUnknown author"
    artist = re.sub(r"\b(.+?)\1\b", r"\1", artist)  # 词级重复
    return artist.strip()


def trim_text(s, limit=DESC_MAX):
    s = (s or "").strip()
    if len(s) <= limit:
        return s
    cut = s[:limit]
    # 尽量在句末标点处收尾
    for sep in ("。", "！", "？", ". ", "; ", "；"):
        idx = cut.rfind(sep)
        if idx >= limit * 0.5:
            return cut[: idx + len(sep)].strip()
    return cut.rstrip() + "…"


def filename_from_upload_url(url):
    """从 upload.wikimedia.org 缩略图/原图 URL 反推 Commons 文件名。"""
    if not url:
        return None
    m = re.search(r"/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/]+)", url)
    if m:
        name = urllib.parse.unquote(m.group(1))
        # thumb URL 末尾会是 "640px-名称.jpg"，需要去掉宽度前缀那一段
        return name
    return None


# ----------------------------------------------------------------------------- OSM tags
def fetch_osm_tags(ids_by_type):
    typemap = {"n": "node", "w": "way", "r": "relation"}
    tags = {}
    for t, nums in ids_by_type.items():
        for i in range(0, len(nums), 600):
            chunk = nums[i:i + 600]
            q = f"[out:json][timeout:120];{typemap[t]}(id:{','.join(chunk)});out tags;"
            res = overpass(q)
            for el in res.get("elements", []):
                pid = el["type"][0] + str(el["id"])
                tags[pid] = el.get("tags", {})
            print(f"  OSM tags {t}: {i + len(chunk)}/{len(nums)}", flush=True)
            time.sleep(1)
    return tags


# ----------------------------------------------------------------------------- enrich one
def parse_wikipedia_tag(val):
    """'zh:香港海洋公園' -> ('zh', '香港海洋公園')"""
    if not val or ":" not in val:
        return None
    lang, title = val.split(":", 1)
    lang = lang.strip().lower()
    if re.fullmatch(r"[a-z\-]{2,12}", lang):
        return lang, title.strip()
    return None


def wikidata_entity(qid):
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    data = http_json(url)
    return data.get("entities", {}).get(qid)


def wikipedia_summary(lang, title):
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{t}"
    try:
        return http_json(url)
    except Exception:  # noqa: BLE001
        return None


def commons_imageinfo(filename):
    """返回 (thumburl, width, height, credit, source_url) 或 None"""
    name = filename
    if name.lower().startswith("file:"):
        name = name[5:]
    title = "File:" + name
    params = {
        "action": "query",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata",
        "iiurlwidth": str(THUMB_WIDTH),
        "format": "json",
        "formatversion": "2",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
    except Exception:  # noqa: BLE001
        return None
    pages = data.get("query", {}).get("pages", [])
    if not pages or "imageinfo" not in pages[0]:
        return None
    ii = pages[0]["imageinfo"][0]
    meta = ii.get("extmetadata", {})
    artist = clean_artist(strip_html(meta.get("Artist", {}).get("value", "")))
    lic = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
    if not artist and lic:
        artist = "Unknown author"
    credit_parts = [p for p in (artist, lic) if p]
    credit = " · ".join(credit_parts) if credit_parts else "Wikimedia Commons"
    source_url = ii.get("descriptionurl") or ("https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title))
    return (
        ii.get("thumburl"),
        ii.get("thumbwidth"),
        ii.get("thumbheight"),
        trim_text(credit, 120),
        source_url,
    )


def download_image(url, poi_id):
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    safe = re.sub(r"[^A-Za-z0-9_-]", "", poi_id)
    fname = f"{safe}{ext}"
    dest = os.path.join(IMG_DIR, fname)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        blob = resp.read()
    if len(blob) < 512:  # 太小多半是占位/错误
        raise RuntimeError("image too small")
    with open(dest, "wb") as f:
        f.write(blob)
    return f"{IMG_PUBLIC_PREFIX}/{fname}", len(blob)


def enrich_one(pid, tags):
    """返回富集字段 dict 或 None。"""
    qid = tags.get("wikidata")  # 仅本体（忽略 brand:wikidata）
    wp = parse_wikipedia_tag(tags.get("wikipedia", ""))
    commons_tag = tags.get("wikimedia_commons", "")
    img_tag = tags.get("image", "")

    if not (qid or wp or commons_tag or filename_from_upload_url(img_tag)):
        return None

    en_title = zh_title = None
    wd_desc = {"en": "", "zh": ""}
    p18 = None

    if qid:
        try:
            ent = wikidata_entity(qid)
        except Exception:  # noqa: BLE001
            ent = None
        if ent:
            claims = ent.get("claims", {})
            if "P18" in claims:
                try:
                    p18 = claims["P18"][0]["mainsnak"]["datavalue"]["value"]
                except Exception:  # noqa: BLE001
                    p18 = None
            links = ent.get("sitelinks", {})
            if "enwiki" in links:
                en_title = links["enwiki"]["title"]
            for code in ("zhwiki", "zhyuewiki", "zh_yuewiki"):
                if code in links:
                    zh_title = links[code]["title"]
                    break
            descs = ent.get("descriptions", {})
            wd_desc["en"] = descs.get("en", {}).get("value", "")
            for code in ("zh", "zh-hk", "zh-hant", "zh-cn", "zh-hans"):
                if code in descs:
                    wd_desc["zh"] = descs[code]["value"]
                    break

    if wp and not (en_title or zh_title):
        lang, title = wp
        if lang.startswith("zh"):
            zh_title = title
        elif lang == "en":
            en_title = title

    # 维基百科摘要（介绍 + 备用图）
    desc = {"en": "", "zh": ""}
    thumb_fallback = None
    wp_url = ""
    if en_title:
        s = wikipedia_summary("en", en_title)
        if s:
            desc["en"] = trim_text(s.get("extract", ""))
            wp_url = s.get("content_urls", {}).get("desktop", {}).get("page", "") or wp_url
            thumb_fallback = thumb_fallback or (s.get("thumbnail") or {}).get("source")
    if zh_title:
        s = wikipedia_summary("zh", zh_title)
        if s:
            desc["zh"] = trim_text(s.get("extract", ""))
            wp_url = s.get("content_urls", {}).get("desktop", {}).get("page", "") or wp_url
            thumb_fallback = thumb_fallback or (s.get("thumbnail") or {}).get("source")

    # 用 Wikidata 简短描述兜底
    if not desc["en"]:
        desc["en"] = trim_text(wd_desc["en"])
    if not desc["zh"]:
        desc["zh"] = trim_text(wd_desc["zh"])

    # 决定 Commons 文件名
    filename = None
    if p18:
        filename = p18
    elif commons_tag:
        filename = commons_tag
    elif thumb_fallback:
        filename = filename_from_upload_url(thumb_fallback)
    elif filename_from_upload_url(img_tag):
        filename = filename_from_upload_url(img_tag)

    image_path = image_credit = image_source = ""
    img_w = img_h = 0
    if filename:
        info = commons_imageinfo(filename)
        if info and info[0]:
            thumburl, img_w, img_h, image_credit, image_source = info
            try:
                image_path, _ = download_image(thumburl, pid)
            except Exception:  # noqa: BLE001
                image_path = ""
        elif thumb_fallback:
            # Commons 查不到（极少数本地维基图），直接下载摘要图
            try:
                image_path, _ = download_image(thumb_fallback, pid)
                image_credit = "Wikipedia"
                image_source = wp_url
            except Exception:  # noqa: BLE001
                image_path = ""

    has_desc = bool(desc["en"] or desc["zh"])
    if not image_path and not has_desc:
        return None

    out = {}
    if image_path:
        out["image"] = image_path
        out["imageCredit"] = image_credit
        out["imageSource"] = image_source
        if img_w and img_h:
            out["imageW"] = img_w
            out["imageH"] = img_h
    if has_desc:
        out["description"] = {"en": desc["en"], "zh": desc["zh"]}
        if wp_url:
            out["wikipediaUrl"] = wp_url
    return out


# ----------------------------------------------------------------------------- main
def main():
    dry = "--dry-run" in sys.argv
    data = json.load(open(POIS_JSON, encoding="utf-8"))

    # 收集唯一 id 与类型；同一 POI 可能挂在多个站点
    id2type = {}
    for rows in data.values():
        for p in rows:
            id2type[p["id"]] = p["type"]
    ids_by_type = {"n": [], "w": [], "r": []}
    for pid in id2type:
        if pid[0] in ids_by_type:
            ids_by_type[pid[0]].append(pid[1:])

    print(f"unique POIs: {len(id2type)}", flush=True)
    print("fetching OSM tags ...", flush=True)
    tags = fetch_osm_tags(ids_by_type)

    # 候选：拥有本体维基/图片标签者
    candidates = []
    for pid, typ in id2type.items():
        tg = tags.get(pid, {})
        if (
            tg.get("wikidata")
            or parse_wikipedia_tag(tg.get("wikipedia", ""))
            or tg.get("wikimedia_commons")
            or filename_from_upload_url(tg.get("image", ""))
        ):
            candidates.append(pid)
    print(f"enrichment candidates: {len(candidates)} "
          f"(attraction-heavy; chains excluded)", flush=True)

    if dry:
        from collections import Counter
        print("by type:", Counter(id2type[p] for p in candidates))
        return

    os.makedirs(IMG_DIR, exist_ok=True)
    enriched = {}  # pid -> fields
    n_img = n_desc = 0
    for i, pid in enumerate(candidates, 1):
        try:
            fields = enrich_one(pid, tags.get(pid, {}))
        except Exception as e:  # noqa: BLE001
            print(f"  [{i}/{len(candidates)}] {pid}: ERROR {e}", flush=True)
            fields = None
        if fields:
            enriched[pid] = fields
            n_img += 1 if fields.get("image") else 0
            n_desc += 1 if fields.get("description") else 0
            tag = []
            if fields.get("image"):
                tag.append("img")
            if fields.get("description"):
                tag.append("desc")
            print(f"  [{i}/{len(candidates)}] {pid}: {'+'.join(tag)}", flush=True)
        else:
            print(f"  [{i}/{len(candidates)}] {pid}: (none)", flush=True)
        time.sleep(0.3)

    # 写回每个站点下的对应行
    for rows in data.values():
        for p in rows:
            f = enriched.get(p["id"])
            if f:
                p.update(f)

    with open(POIS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\nDONE: enriched {len(enriched)} unique POIs "
          f"(images: {n_img}, descriptions: {n_desc})", flush=True)
    print(f"images saved under: {IMG_DIR}", flush=True)


if __name__ == "__main__":
    main()
