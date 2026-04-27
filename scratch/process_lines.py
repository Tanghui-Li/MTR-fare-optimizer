import csv
import json

lines = {}
line_names = {
    "AEL": {"zh": "機場快綫", "en": "Airport Express"},
    "DRL": {"zh": "迪士尼綫", "en": "Disneyland Resort Line"},
    "EAL": {"zh": "東鐵綫", "en": "East Rail Line"},
    "ISL": {"zh": "港島綫", "en": "Island Line"},
    "KTL": {"zh": "觀塘綫", "en": "Kwun Tong Line"},
    "TML": {"zh": "屯馬綫", "en": "Tuen Ma Line"},
    "TCL": {"zh": "東涌綫", "en": "Tung Chung Line"},
    "TKL": {"zh": "將軍澳綫", "en": "Tseung Kwan O Line"},
    "TWL": {"zh": "荃灣綫", "en": "Tsuen Wan Line"},
    "SIL": {"zh": "南島綫", "en": "South Island Line"}
}

# ID Mapping for Hub Stations
ID_MAP = {
    '44': '39', # Hong Kong
    '45': '40', # Kowloon
    '46': '42'  # Tsing Yi
}

def map_id(sid):
    sid = str(sid).strip()
    return ID_MAP.get(sid, sid)

with open('opendata/mtr_lines_and_stations.csv', mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        line_code = row['Line Code']
        if not line_code: continue
        station_id = map_id(row['Station ID'])
        
        if line_code not in lines:
            lines[line_code] = {
                "name": line_names.get(line_code, {"zh": line_code, "en": line_code}),
                "stations": []
            }
        
        if station_id not in lines[line_code]["stations"]:
            lines[line_code]["stations"].append(station_id)

with open('src/lines.json', 'w', encoding='utf-8') as f:
    json.dump(lines, f, ensure_ascii=False, indent=2)

print("lines.json created successfully with merged hub IDs")
