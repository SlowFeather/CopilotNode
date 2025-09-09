# 边界设置布局修复

## 修复的问题

### 1. 显示逻辑问题
**问题**：只有在点击画图时才显示边界设置
**解决**：
- 在 `selectDrawing()` 方法中添加了属性面板更新调用
- 在 `clearCurrentDrawing()` 方法中也添加了对应的清理逻辑
- 在画图管理器初始化时设置正确的属性面板状态

### 2. 布局问题
**问题**：横向布局会超出屏幕
**解决**：
- 将边界设置改为完全纵向布局
- 每个输入框占用一行，有独立的标签
- 按钮也改为纵向排列，防止在小屏幕上换行

## 具体修改

### HTML结构 (index.html)
```html
<!-- 原来的横向布局 -->
<div class="input-row">
    <div class="input-with-label">
        <label>X:</label>
        <input type="number" id="boundaryX">
    </div>
    <div class="input-with-label">
        <label>Y:</label>
        <input type="number" id="boundaryY">
    </div>
</div>

<!-- 新的纵向布局 -->
<div class="input-group">
    <label class="boundary-label">X坐标</label>
    <input type="number" id="boundaryX" class="boundary-input">
</div>
<div class="input-group">
    <label class="boundary-label">Y坐标</label>
    <input type="number" id="boundaryY" class="boundary-input">
</div>
```

### CSS样式 (style.css)
- 移除了 `.input-row` 和 `.input-with-label` 样式
- 按钮改为纵向排列（`flex-direction: column`）
- 按钮设置为全宽（`width: 100%`）

### JavaScript逻辑 (drawing-manager.js)
```javascript
// 在selectDrawing方法中添加
if (window.app && typeof window.app.updatePropertiesPanel === 'function') {
    window.app.updatePropertiesPanel(null); // 触发属性面板更新
}

// 在clearCurrentDrawing方法中添加
if (typeof window.app.updatePropertiesPanel === 'function') {
    window.app.updatePropertiesPanel(null); // 清理属性面板状态
}
```

## 测试验证

### 预期行为：
1. **选中画图后**：
   - 右侧属性面板立即显示边界设置
   - 显示"当前画图已选择，可在下方设置操作边界"提示
   - 边界设置区域在属性面板底部显示

2. **边界设置界面**：
   - X坐标、Y坐标、宽度、高度各占一行
   - 每个输入框有清晰的标签
   - "应用边界"和"预览边界"按钮纵向排列
   - 在小屏幕上不会超出显示范围

3. **取消选择画图时**：
   - 边界设置区域自动隐藏
   - 属性面板恢复到默认状态

### 兼容性：
- 适配不同屏幕尺寸
- 保持与整体UI风格一致
- 响应式设计，防止内容溢出