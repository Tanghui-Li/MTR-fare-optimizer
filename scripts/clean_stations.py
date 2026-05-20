import csv
import json

ID_MAP = {
    '44': '39', # Hong Kong
    '45': '40', # Kowloon
    '46': '42'  # Tsing Yi
}

def map_id(sid):
    sid = str(sid).strip()
    return ID_MAP.get(sid, sid)

def build_station_map():
    print("正在提取站点元数据...")
    try:
        station_map = {}
        with open('opendata/mtr_lines_and_stations.csv', mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                st_id = map_id(row['Station ID'])
                if st_id.lower() == 'nan' or not st_id: 
                    continue
                
                zh_name = str(row['Chinese Name']).strip()
                en_name = str(row['English Name']).strip()
                
                if st_id not in station_map:
                    station_map[st_id] = {
                        "zh": zh_name,
                        "en": en_name
                    }
        
        with open('src/stations.json', 'w', encoding='utf-8') as f:
            json.dump(station_map, f, indent=2, ensure_ascii=False)
            
        print(f"成功！已生成 src/stations.json (已合并 AEL 枢纽站 ID)。")
        
    except Exception as e:
        print(f"处理失败: {e}")

if __name__ == "__main__":
    build_station_map()
