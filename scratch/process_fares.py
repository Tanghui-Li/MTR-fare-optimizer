import csv
import json
import os

fare_matrix = {
    "octopus": {},
    "single": {}
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

def add_fare(matrix_type, src_id, dest_id, fare):
    if not src_id or not dest_id: return
    src_id = map_id(src_id)
    dest_id = map_id(dest_id)
    
    if src_id not in fare_matrix[matrix_type]:
        fare_matrix[matrix_type][src_id] = {}
    
    fare_val = float(fare)
    # If multiple fares exist for the same merged ID pair, take the minimum (though usually they are same or unique)
    if dest_id in fare_matrix[matrix_type][src_id]:
        fare_matrix[matrix_type][src_id][dest_id] = min(fare_matrix[matrix_type][src_id][dest_id], fare_val)
    else:
        fare_matrix[matrix_type][src_id][dest_id] = fare_val

# 1. Process MTR Lines Fares
with open('opendata/mtr_lines_fares.csv', mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        src_id = row['SRC_STATION_ID']
        dest_id = row['DEST_STATION_ID']
        add_fare("octopus", src_id, dest_id, row['OCT_ADT_FARE'])
        add_fare("single", src_id, dest_id, row['SINGLE_ADT_FARE'])

# 2. Process Airport Express Fares
with open('opendata/airport_express_fares.csv', mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        src_id = row['ST_FROM_ID']
        dest_id = row['ST_TO_ID']
        add_fare("octopus", src_id, dest_id, row['OCT_ADT_FARE'])
        add_fare("single", src_id, dest_id, row['SINGLE_ADT_FARE'])

# 3. Handle same-station transfers (ensure self-loops are 0)
for mt in ["octopus", "single"]:
    for sid in fare_matrix[mt]:
        fare_matrix[mt][sid][sid] = 0.0

with open('src/fare_matrix.json', 'w', encoding='utf-8') as f:
    json.dump(fare_matrix, f, ensure_ascii=False, indent=2)

print("Unified fare_matrix.json created successfully with merged hub IDs")
