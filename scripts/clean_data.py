import pandas as pd
import json

def build_fare_matrix():
    # 读取你下载的官方 CSV
    # 强制按字符串读取
    df = pd.read_csv('opendata/mtr_lines_fares.csv', dtype=str)
    df = df.dropna(subset=['SRC_STATION_ID', 'DEST_STATION_ID'])
    fare_matrix = {}
    for _, row in df.iterrows():
        src = str(row['SRC_STATION_ID']).strip()
        dest = str(row['DEST_STATION_ID']).strip()
        if src.lower() == 'nan' or dest.lower() == 'nan':
            continue
        
        # 只有票价本身需要转成 float



        fare = float(row['OCT_ADT_FARE'])
        
        if src not in fare_matrix:
            fare_matrix[src] = {}
        fare_matrix[src][dest] = fare
        
    with open('fare_matrix.json', 'w') as f:
        json.dump(fare_matrix, f, indent=2)
    print("票价矩阵构建完成！")

if __name__ == "__main__":
    build_fare_matrix()
