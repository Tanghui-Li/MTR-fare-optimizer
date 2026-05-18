# TASKS

本文档记录当前项目已确认的问题、后续任务和验证状态。项目定位是人机交互导论大作业，优先级应以可演示、交互友好、桌面端/移动端自适应、UI 一致性为主。

## 最高优先级

### 1. 恢复真实 `opendata/` 数据（已解决）

真实 `opendata/` 数据已恢复。代码会在启动和构建时静态导入以下文件：

- `opendata/light_rail_fares.csv`
- `opendata/light_rail_routes_and_stops.csv`
- `opendata/mtr_bus_fares.csv`
- `opendata/mtr_bus_routes.csv`
- `opendata/mtr_bus_stops.csv`

阻塞位置：

- `src/data/unifiedNetwork.ts`

历史影响：

- Vite dev server 曾可以监听端口，但真实页面加载会因缺失 CSV 报错。
- `npm run build` 曾因缺失 CSV 失败。
- 当前已用真实开放数据解决，不使用占位 CSV。

后续要求：

- 保持 `opendata/` 数据来源可追溯。
- 数据更新后重新运行 `npm run build` 验证。

### 2. 明确数据获取链路（已解决）

当前仓库内没有发现爬虫代码。已有脚本只处理本地 CSV：

- `clean_data.py`
- `clean_stations.py`
- `scratch/process_fares.py`
- `scratch/process_lines.py`

已有前端实时请求封装：

- `src/services/mtrApi.ts`

后续需要决定：

- 是否补一个明确的“数据下载/整理说明”。
- 是否需要脚本自动下载官方 CSV。
- 如果不写下载脚本，至少在 README 中说明 `opendata/` 文件来源和放置方式。

## UI / HCI 改造任务

### 3. 统一设计语言

建议采用：

- `Material 3-inspired Transit UI`

含义：

- 借鉴 Material 3 的 Surface 层级、Bottom Sheet、Segmented Control、Filter Chips、焦点态、状态反馈。
- 不完整照搬 Material 3 默认视觉。
- 保留港铁/交通工具特征：克制、清晰、可扫描，线路色只用于线路和路线标签。

避免：

- 页面整体过度灰蓝或紫色。
- 营销页式大面积装饰。
- 把交通工具做成通用后台或普通 Material App。

### 4. 选择自适应 UI 技术方案

当前最推荐：

- Tailwind CSS
- shadcn/ui
- Radix UI
- Vaul Drawer
- lucide-react

原因：

- 当前项目已经使用 React + Tailwind/自定义 CSS。
- shadcn/ui 组件源码可进入项目内，便于改成 MTR 风格。
- Radix 能解决当前自制下拉、弹层、Tabs 的键盘和 ARIA 问题。
- Vaul 适合移动端地图应用的底部抽屉。

备选：

- Mantine：组件完整，适合从头做，但迁移成本比 shadcn 高。
- MUI：Material 体系成熟，但默认视觉容易和 MTR 风格割裂。
- Ant Design：不推荐，太像后台系统。

### 5. 重做移动端布局

状态：部分处理。

当前问题：

- `src/index.css` 中 `.app-root` 曾使用 `height: 100vh` 和 `overflow: hidden`，移动端页面可能无法完整滚动。
- `900px` 以下上下布局仍不是最终理想形态，还没有完成 Bottom Sheet。

已处理：

- 移动端根容器改为可纵向滚动。
- 地图在移动端使用稳定的 `vh/dvh` 高度。
- 地图控制条允许换行，减少小屏溢出风险。
- 移动端已改为地图主画布 + 底部路线规划面板。
- 底部面板折叠态高度和表单间距已调整，390px 宽手机首屏可覆盖路线规划主路径。

建议移动端结构：

- 地图作为主画布。
- 底部使用可拖拽 Bottom Sheet；当前仍是点击展开/收起，后续可接入 Vaul。
- Bottom Sheet 内放起终点、票种、路线结果。
- 地图图层控制收进按钮或 Sheet。

建议桌面端结构：

- 左侧控制/结果面板。
- 右侧地图。
- 左侧宽度控制在约 `420px-520px`，不要过宽。

### 6. 替换自制车站下拉

状态：部分处理。

当前问题：

- `src/components/ControlPanel.tsx` 的 `SearchableDropdown` 已从 `div onClick` 改为按钮触发器和 `listbox/option` 结构。
- 已补 `aria-expanded`、`aria-controls`、`aria-selected`，并支持 `Escape` 关闭、方向键移动和 `Enter` 选择。
- 仍未替换为完整的 shadcn/Radix Combobox，但键盘主路径已覆盖。

建议：

- 用 shadcn/Radix 的 `Command + Popover` 或等价 Combobox。
- 长期可替换为 shadcn/Radix Combobox，减少自维护交互细节。
- 加 `aria-expanded`、`aria-controls`、可见焦点态。

### 7. 降低地图首屏信息密度

状态：已处理第一步。

当前问题：

- 轻铁站、巴士站、实时巴士此前默认全部开启。
- 地图上方图例过长，移动端首屏拥挤。

已处理：

- 轻铁站、巴士站、实时巴士默认关闭，用户可通过开关主动开启。

建议：

- 默认突出 MTR 路线规划主任务。
- 把实时巴士、巴士站、轻铁图层放入“图层”按钮。
- 图例移动端默认折叠。

### 8. 统一多语言文案

状态：已处理第一步。

当前问题：

- `src/components/AccessibilityFilter.tsx` 曾大量写死繁体中文。
- 切换英文/简体时无障碍筛选器曾不会同步语言。
- “CNF” 对普通用户不友好。

已处理：

- `AccessibilityFilter` 已接收 `locale`。
- 面板标题、模式、提示、按钮、设施项已按语言切换。
- “CNF” 已替换为更面向用户的“条件组合”类文案。

建议：

- 给 `AccessibilityFilter` 传入 `locale`。
- 文案移入 `src/i18n.ts`。
- 将“CNF”改成用户可理解的“满足全部条件 / 满足任一条件”。

### 9. 清理演示残留文案

状态：已处理。

已处理问题：

- `src/components/RouteVisualizer.tsx` 中的 `HACKED` 已替换为正式展示文案。
- `src/App.tsx` 中的 `UI Version: 2.1.0-neutral-grey` 已移除。

建议：

- 删除或替换为面向用户的正式信息。
- 不在正式演示页面显示内部版本/调试文案。

## 工程质量任务

### 10. 修复 lint 脚本

状态：已处理。

历史情况：

- `package.json` 有 `npm run lint`。
- 仓库曾没有 ESLint 配置，运行会失败。

已处理：

- 已添加项目匹配的 ESLint 配置。
- 当前 `npm run lint` 可通过。

### 11. 明确测试策略

状态：已处理第一步。

当前情况：

- 仓库未发现测试文件。
- README 已补充前端验证与视觉验收清单。
- README 已记录 Playwright CLI 桌面端/移动端截图命令。

建议：

- 至少补轻量级核心逻辑测试：票价矩阵、路径规划、同站/缺失路径边界。
- UI 后续可引入 Playwright Test，把当前人工验收清单固化为截图/交互测试。

### 12. 控制构建体积

状态：已处理第一步。

已观察到：

- 之前在临时占位 CSV 存在时构建成功，但 JS chunk 超过 500 kB，Vite 给出警告。
- 恢复真实数据后，未拆包时主应用 chunk 接近 960 kB。

已处理：

- 已在 `vite.config.ts` 中按 React、Leaflet、开放数据、静态交通数据、票价数据拆分 chunk。
- 当前构建不再出现超过 500 kB 的 chunk 警告。

建议：

- 数据恢复后重新构建确认真实体积。
- 必要时对地图/实时图层做动态加载或手动拆包。

## 当前验证状态

- `npm ci`：已运行成功。
- `npm run dev -- --host 0.0.0.0`：此前已启动过，Vite 可监听 `0.0.0.0:5173`。
- 页面真实加载：数据已恢复，缺失 `opendata/*.csv` 的阻塞已解除。
- `npm run build`：已通过；chunk 拆分后不再出现超过 500 kB 的 Vite 警告。
- `npm run lint`：已通过。
- 测试：仓库未发现测试文件，未运行测试。

## 推荐执行顺序

1. 修复/补齐数据来源说明。
2. 重构移动端为地图 + Bottom Sheet。
3. 替换自制车站下拉，补可访问性。
4. 收敛地图图层和无障碍筛选交互。
5. 统一设计 token、文案和正式演示细节。
6. 补最低限度测试或人工验收清单。
7. 后续可继续做地图/实时图层按需加载，进一步降低首屏执行成本。
