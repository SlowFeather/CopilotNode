# CopilotNode 节点类型

本目录包含 CopilotNode 应用的所有节点类型定义，按功能分类组织。

## 文件结构

### 节点类型文件

- **`action-nodes.js`** - 操作节点
  - `ClickNode` - 点击节点：在指定坐标点击鼠标
  - `MoveNode` - 移动节点：移动鼠标到指定位置
  - `KeyboardNode` - 键盘节点：发送键盘输入或按键
  - `WaitNode` - 等待节点：暂停执行指定时间

- **`image-nodes.js`** - 图像识别节点
  - `FindImgNode` - 查找图像节点：在屏幕上查找指定图像
  - `ClickImgNode` - 点击图像节点：查找图像并点击
  - `FollowImgNode` - 跟随图像节点：移动鼠标到图像位置

- **`logic-nodes.js`** - 逻辑控制节点
  - `IfNode` - IF条件节点：根据条件执行分支逻辑
  - `ConnectionNode` - 连接节点：节点连接控制

### 管理文件

- **`index.js`** - 节点类型注册表和管理器
  - 提供节点分类信息
  - 验证节点类型加载状态
  - 提供节点查询接口

## 节点开发规范

### 基本结构

每个节点类型应该包含：

```javascript
function NodeName() {
    this.title = "节点显示名称";
    this.addInput("输入名", "类型");  // 可选
    this.addOutput("输出名", "类型"); // 可选
    this.addProperty("属性名", 默认值);
    this.size = [宽度, 高度];
    this.color = "#颜色代码";
    this.bgcolor = "#背景颜色代码";
}

NodeName.title = "节点显示名称";
NodeName.desc = "节点功能描述";

NodeName.prototype.onExecute = function() {
    // 执行逻辑（通常由后端处理）
};

// 注册节点类型
LiteGraph.registerNodeType("autoclick/nodename", NodeName);
```

### 颜色规范

- 操作节点：蓝色系 `#4a90e2`, `#50c878`, `#9b59b6`, `#f39c12`
- 图像节点：橙色/红色系 `#e67e22`, `#e74c3c`, `#1abc9c`  
- 逻辑节点：紫色/灰色系 `#8e44ad`, `#95a5a6`

### 属性命名规范

- 坐标：`x`, `y`
- 随机范围：`x_random`, `y_random`
- 时间：`duration`, `duration_random`
- 图像：`image_path`, `confidence`
- 条件：`condition_type`, `expected_result`

## 添加新节点类型

1. 在对应的类别文件中添加节点定义
2. 在 `index.js` 的 categories 中更新节点类型列表
3. 在主应用的 `setDefaultProperties` 方法中添加默认属性
4. 在 `getPropertyLabel` 方法中添加属性标签翻译

## 节点交互

- **右键菜单**：通过 `getExtraMenuOptions` 添加自定义菜单项
- **属性面板**：通过 `addProperty` 添加的属性会自动显示在属性面板中
- **图像上传**：图像相关节点应提供上传图像的菜单项

## 调试

- 节点加载状态会在浏览器控制台中显示
- 使用 `CopilotNodeNodes.validateNodeTypes()` 检查所有节点是否正确加载
- 使用 `CopilotNodeNodes.getNodeInfo(nodeType)` 获取节点信息

## 项目保存/加载调试

- 使用 `debugProject()` 验证当前项目数据结构
- 使用 `testSaveLoad()` 测试保存加载功能
- 项目文件包含详细的连接信息和调试数据

### 连接数据格式

新的连接格式支持多输出端口：

```javascript
{
  "connections": [
    {
      "target_id": "目标节点ID",
      "output_slot": 0,  // 输出端口索引
      "input_slot": 0    // 输入端口索引
    }
  ]
}
```

同时向后兼容旧格式（字符串数组）。