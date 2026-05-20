# MTR Fare Optimizer & Transit Interface (人机交互导论大作业)

本项目为“人机交互导论”课程大作业，核心目标是打造一个基于真实数据的**港铁最优票价计算器**与**综合交通实时地图**。
我们在仅使用香港政府官方开放数据（data.gov.hk 等）的前提下，构建了包含路径规划、实时巴士追踪、无障碍设施查询的综合性交互式 Web 应用。

## 🌟 核心功能

1. **智能票价计算与路径优化 (Fare Optimizer)**
   - **最优路径计算**：支持以“出入闸”为界的换乘分段优化，自动以“换乘次数最少”和“乘坐区间数量最少”为双重关键字计算最优路线。
   - **The Boring Way**：提供最基础的无优化线路规划，与最优路径进行对比。
   - **全票种支持**：支持普通八达通等多种票价矩阵体系的查询。

2. **综合实时交通地图 (Unified Map Interface)**
   - **MTR 拓扑网络**：基于真实地理坐标，精准绘制了包含支线（如东铁线、将军澳线）在内的边级 (Edge-based) 港铁拓扑网络。
   - **轻铁系统 (LRT)**：独立的轻铁站展示层，点击可查看实时月台班次信息。
   - **港铁巴士 (MTR Bus)**：
     - **巴士站**：青色独立站点标注，附带途经路线的 Tooltip。
     - **实时巴士**：动态更新的琥珀色巴士图标，追踪车辆实时位置。

3. **无障碍设施支持与筛选 (Accessibility Support)**
   - **全局无障碍筛选器**：支持基于合取范式 (CNF) 的高级逻辑筛选。用户可选择所需的一项或多项设施（如电梯、轮椅通道等），符合条件的车站会紫光高亮，其余车站自动变暗。
   - **车站弹出详情卡**：统一滚动视图，默认完全展开显示所有无障碍设施详情，包含行动不便、听觉障碍、视觉障碍等分类。

## 📂 项目结构

```text
Project/
├── src/
│   ├── components/
│   │   ├── MapView.tsx             // 核心地图容器，包含各种 Layer 与 Filter 的集成
│   │   ├── StationPopup.tsx        // 港铁车站弹出卡 (列车班次 + 无障碍设施)
│   │   ├── AccessibilityFilter.tsx // 无障碍设施条件筛选面板
│   │   ├── BusLayer.tsx            // 港铁巴士实时位置渲染
│   │   ├── BusStopLayer.tsx        // 港铁巴士固定站点渲染
│   │   ├── LRTStationLayer.tsx     // 轻铁车站渲染
│   │   └── LRTPopup.tsx            // 轻铁实时班次弹出卡
│   ├── data/
│   │   ├── accessibilityData.json  // 处理后的无障碍设施元数据
│   │   ├── lrtStations.json        // 轻铁车站地理坐标数据
│   │   ├── stationCoordinates.ts   // 港铁站坐标字典
│   │   └── lineSegments.ts         // 用于绘制边级网络拓扑的文件
│   ├── services/
│   │   └── mtrApi.ts               // 封装所有 data.gov.hk REST API 的网络请求 (列车、巴士、轻铁)
│   ├── pathfinder.ts               // Dijkstra 算法与路由寻路逻辑
│   ├── routePlanner.ts             // 路径优化与 The Boring Way 切分逻辑
│   ├── App.tsx                     // 全局状态管理、左右面板布局
│   └── index.css                   // UI 设计样式
└── opendata/                       // 存放所有港府 Open Data 原始数据 CSV 及 PDF 文档
```

## 🛠️ 技术栈

* **核心框架**：React 18 + TypeScript + Vite
* **地图渲染**：Leaflet + React-Leaflet
* **数据来源**：
  * **静态结构数据**：通过本地 Python 脚本预处理 `opendata` 目录下的 CSV 文件生成。
  * **动态实时数据**：使用 Fetch API 直接与 `data.gov.hk` 的 CKAN REST API 交互（无第三方商业 API）。
* **UI 样式**：自定义 Vanilla CSS 配合现代扁平化与半透明玻璃态设计。

## 📊 数据文件说明

本项目依赖仓库内的 `opendata/` 目录。该目录保存来自香港政府公开数据和港铁开放资料的原始 CSV、数据规格 PDF 与接口文档。前端构建会直接读取部分 CSV，因此该目录不是可选资源。

当前构建所需的关键 CSV 包括：

- `opendata/mtr_lines_and_stations.csv`
- `opendata/mtr_lines_fares.csv`
- `opendata/airport_express_fares.csv`
- `opendata/light_rail_fares.csv`
- `opendata/light_rail_routes_and_stops.csv`
- `opendata/mtr_bus_fares.csv`
- `opendata/mtr_bus_routes.csv`
- `opendata/mtr_bus_stops.csv`
- `opendata/barrier_free_facilities.csv`
- `opendata/barrier_free_facility_category.csv`

仓库中的 Python 脚本只负责处理本地 CSV，不会自动爬取或下载数据：

- `scripts/clean_data.py`
- `scripts/clean_stations.py`
- `scratch/process_fares.py`
- `scratch/process_lines.py`

如果重新获取或更新开放数据，应先替换 `opendata/` 中对应文件，再运行相关处理脚本，并最后执行：

```bash
npm run lint
npm run build
```

## 🧑‍💻 小组协作指南 (How to run and contribute)

1. **环境准备**
   请确保本地安装了 Node.js (推荐 v18+)。

2. **安装依赖**
   在项目根目录下执行：
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   随后在浏览器中打开 `http://localhost:5173` 预览应用。

   如需在局域网或容器环境中访问，请监听 `0.0.0.0`：
   ```bash
   npm run dev -- --host 0.0.0.0
   ```

4. **组件开发规范**
   - **地图图层**：所有地图上的点/线尽量封装为独立的 `<LayerGroup>` 组件（参考 `LRTStationLayer.tsx`），避免直接在 `MapView` 中堆砌导致 React-Leaflet 初始化渲染 Bug。
   - **API 调用**：请统一将新的 `fetch` 请求封装在 `src/services/mtrApi.ts` 中，使用强类型的 TypeScript 接口定义。
   - **样式修改**：统一样式表为 `index.css`，采用 BEM 命名或带作用域前缀的类名，避免样式污染。

## ✅ 前端验证与视觉验收

每次修改后至少运行：

```bash
npm run test
npm run lint
npm run build
```

当前仓库尚未引入自动化测试框架。涉及 UI、自适应或地图交互的改动，应额外做以下人工验收：

- 桌面端 `1440x900`：左侧路线规划面板与右侧地图应同时可见，地图图层控制不应遮挡主导航。
- 移动端 `390x844`：首屏应以地图为主，底部路线规划面板应能看到票种、起点和终点主表单。
- 窄屏移动端 `360x740`：语言切换、地图图层开关、底部面板和下拉框不应相互覆盖。
- 车站下拉：鼠标、触控、方向键、Enter、Escape 均应能完成主路径操作。
- 多语言：繁体中文、英文、简体中文切换后，导航、路线规划、无障碍筛选文案应同步更新。

可用 Playwright CLI 生成视觉检查截图：

```bash
npx playwright screenshot --browser=chromium --viewport-size=390,844 http://127.0.0.1:5173/ /tmp/mtr-mobile.png
npx playwright screenshot --browser=chromium --viewport-size=1440,900 http://127.0.0.1:5173/ /tmp/mtr-desktop.png
```

## ✅ 近期更新日志 (Change Log)
* 修复了轻铁站按钮需二次切换才能显示的 Leaflet 生命周期 Bug。
* 车站弹窗（StationPopup）取消了无障碍设施的手动折叠，调整为单滚动条结构，完整展现所有设施数据。
* 明确区分了巴士站（青色）与实时巴士（琥珀色）的视觉呈现。
* 新增全局无障碍筛选器，支持简单组合与复杂 CNF 逻辑检索。
