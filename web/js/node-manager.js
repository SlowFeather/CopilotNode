// 节点管理模块 - 负责节点的创建、属性管理和数据导入导出
class NodeManager {
    constructor(app) {
        this.app = app;
    }

    addNodeToGraph(nodeType, position, autoSelect = true, predefinedId = null) {
        // Check if we have a current drawing selected
        if (window.drawingManager && !window.drawingManager.currentDrawingId) {
            this.app.showNotification('请先在左侧选择或创建一个画图才能添加节点！', 'warning');
            console.log('addNodeToGraph blocked: No drawing selected');
            return null;
        }

        console.log(`addNodeToGraph called: nodeType=${nodeType}, position=`, position, `predefinedId=${predefinedId}`);
        console.log('Drawing manager state:', {
            exists: !!window.drawingManager,
            currentDrawingId: window.drawingManager?.currentDrawingId
        });

        const nodeClassName = `autoclick/${nodeType}`;
        console.log(`Attempting to create node: ${nodeClassName}`);
        const node = LiteGraph.createNode(nodeClassName);

        if (node) {
            console.log('Node created successfully:', node);
            node.pos = position;
            // Set action_type property to match backend expectations
            node.properties = node.properties || {};
            node.properties.action_type = nodeType;

            // Ensure default properties exist based on node type
            this.setDefaultProperties(node, nodeType);

            // Set predefined ID before adding to graph
            if (predefinedId !== null) {
                node.id = parseInt(predefinedId);
            }

            this.app.graph.add(node);

            // Update graph's internal ID mapping if predefined ID was used
            if (predefinedId !== null && this.app.graph._nodes_by_id) {
                this.app.graph._nodes_by_id[parseInt(predefinedId)] = node;
            }

            // Only select node if autoSelect is true (default for manual adds)
            if (autoSelect) {
                this.app.canvas.selectNode(node);

                // Force update properties panel
                setTimeout(() => {
                    this.app.selectedNode = node;
                    this.updatePropertiesPanel(node);
                }, 100);
            }

            console.log(`Added ${nodeType} node to current drawing:`, window.drawingManager?.currentDrawingId);

            return node;
        } else {
            console.error(`Failed to create node: ${nodeClassName}`);
            console.error('Node type not registered or creation failed');
            this.app.showNotification(`无法创建节点类型: ${nodeType}`, 'error');
            return null;
        }
    }

    setDefaultProperties(node, nodeType) {
        const defaults = {
            'click': { position_mode: 'absolute', x: 0, y: 0, x_random: 0, y_random: 0 },
            'move': { x: 0, y: 0, duration: 0.2, duration_random: 0, speed_factor: 1.0, speed_random: 0 },
            'keyboard': { text: '', key: '' },
            'wait': { duration: 1.0 },
            'mousedown': { position_mode: 'absolute', x: 0, y: 0, button: 'left', x_random: 0, y_random: 0 },
            'mouseup': { position_mode: 'absolute', x: 0, y: 0, button: 'left', x_random: 0, y_random: 0 },
            'mousescroll': { position_mode: 'absolute', x: 0, y: 0, direction: 'up', clicks: 3, x_random: 0, y_random: 0 },
            'findimg': { image_path: '', confidence: 0.8 },
            'clickimg': { image_path: '', confidence: 0.8, x_random: 0, y_random: 0 },
            'followimg': { image_path: '', confidence: 0.8 },
            'if': { condition_type: 'image_exists', image_path: '', target_node_id: '', expected_result: 'true' }
        };

        if (defaults[nodeType]) {
            Object.assign(node.properties, defaults[nodeType]);
        }
    }

    updatePropertiesPanel(node) {
        const content = document.getElementById('propertiesContent');
        
        if (!node) {
            // Check if there's a selected drawing to show boundary settings
            if (window.drawingManager && window.drawingManager.currentDrawingId) {
                content.innerHTML = '<div class="no-node-selection">当前画图已选择，可在下方设置操作边界</div>';
            } else {
                content.innerHTML = '<div class="no-selection">请选择一个节点或画图</div>';
            }
            return;
        }

        console.log('Updating properties panel for node:', node.title, 'properties:', node.properties);

        let html = `<div class="property-group">
            <label class="property-label">节点ID</label>
            <input type="text" class="property-input" value="${node.id || 'N/A'}" readonly>
        </div>`;

        html += `<div class="property-group">
            <label class="property-label">节点类型</label>
            <input type="text" class="property-input" value="${node.title || 'Unknown'}" readonly>
        </div>`;

        // Generate property inputs based on node type
        const properties = node.properties || {};
        console.log('Node properties:', properties);
        
        if (Object.keys(properties).length === 0) {
            html += '<div class="no-selection">此节点没有可配置的属性</div>';
        } else {
            Object.keys(properties).forEach(key => {
                if (key === 'action_type') return; // Skip internal property

                // Smart filtering for keyboard node properties based on input_type
                if (node.title === '键盘' && properties.input_type) {
                    const inputType = properties.input_type;

                    // Skip properties that don't apply to current input type
                    if (inputType === 'text' && (key === 'key' || key === 'special_key' || key === 'modifier_keys' || key === 'hold_duration')) {
                        return;
                    }
                    if (inputType === 'key' && (key === 'text' || key === 'special_key' || key === 'modifier_keys')) {
                        return;
                    }
                    if (inputType === 'special' && (key === 'text' || key === 'key' || key === 'modifier_keys')) {
                        return;
                    }
                    if (inputType === 'combo' && (key === 'text' || key === 'special_key')) {
                        return;
                    }
                }
                
                const value = properties[key];
                
                // Handle different input types based on property name
                let inputHtml = '';
                
                if (key === 'position_mode') {
                    // Position mode dropdown
                    inputHtml = `<select class="property-input" data-property="${key}">
                        <option value="absolute" ${value === 'absolute' ? 'selected' : ''}>绝对坐标</option>
                        <option value="current" ${value === 'current' ? 'selected' : ''}>当前鼠标位置</option>
                    </select>`;
                } else if (key === 'button') {
                    // Mouse button dropdown
                    inputHtml = `<select class="property-input" data-property="${key}">
                        <option value="left" ${value === 'left' ? 'selected' : ''}>左键</option>
                        <option value="right" ${value === 'right' ? 'selected' : ''}>右键</option>
                        <option value="middle" ${value === 'middle' ? 'selected' : ''}>中键</option>
                    </select>`;
                } else if (key === 'direction') {
                    // Scroll direction dropdown
                    inputHtml = `<select class="property-input" data-property="${key}">
                        <option value="up" ${value === 'up' ? 'selected' : ''}>向上</option>
                        <option value="down" ${value === 'down' ? 'selected' : ''}>向下</option>
                    </select>`;
                } else if (key === 'input_type') {
                    // Keyboard input type dropdown
                    inputHtml = `<select class="property-input" data-property="${key}">
                        <option value="text" ${value === 'text' ? 'selected' : ''}>文本输入</option>
                        <option value="key" ${value === 'key' ? 'selected' : ''}>单个按键</option>
                        <option value="special" ${value === 'special' ? 'selected' : ''}>特殊按键</option>
                        <option value="combo" ${value === 'combo' ? 'selected' : ''}>组合按键</option>
                    </select>`;
                } else if (key === 'special_key') {
                    // Special key dropdown
                    const specialKeys = [
                        "enter", "space", "tab", "escape", "backspace", "delete",
                        "up", "down", "left", "right", "home", "end", "page_up", "page_down",
                        "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
                        "insert", "print_screen", "scroll_lock", "pause",
                        "caps_lock", "num_lock", "shift", "ctrl", "alt", "cmd", "win"
                    ];
                    inputHtml = `<select class="property-input" data-property="${key}">`;
                    specialKeys.forEach(keyName => {
                        inputHtml += `<option value="${keyName}" ${value === keyName ? 'selected' : ''}>${keyName}</option>`;
                    });
                    inputHtml += `</select>`;
                } else if (key === 'hold_duration') {
                    // Hold duration number input with step
                    inputHtml = `<input type="number" class="property-input"
                           data-property="${key}"
                           value="${value || 0.1}"
                           min="0"
                           step="0.1">`;
                } else if (key === 'modifier_keys') {
                    // Modifier keys with checkboxes
                    const modifiers = ['ctrl', 'alt', 'shift', 'cmd', 'win'];
                    const selectedModifiers = value ? value.split('+').map(m => m.trim().toLowerCase()) : [];

                    inputHtml = `
                        <div class="modifier-keys-container">
                            ${modifiers.map(mod => `
                                <label class="modifier-checkbox">
                                    <input type="checkbox"
                                           data-modifier="${mod}"
                                           ${selectedModifiers.includes(mod) ? 'checked' : ''}>
                                    <span class="modifier-label">${mod.charAt(0).toUpperCase() + mod.slice(1)}</span>
                                </label>
                            `).join('')}
                        </div>
                        <input type="hidden" class="property-input" data-property="${key}" value="${value || ''}">
                    `;
                } else if (key === 'key' && node.title === '键盘') {
                    // Enhanced key input with suggestions
                    inputHtml = `
                        <div class="key-input-container">
                            <input type="text" class="property-input enhanced"
                                   data-property="${key}"
                                   value="${value || ''}"
                                   placeholder="输入按键，如: a, 1, space"
                                   autocomplete="off">
                            <div class="key-suggestions" id="keySuggestions"></div>
                        </div>
                        <div class="input-help-text">常用: a-z, 0-9, space, enter, tab, shift</div>
                    `;
                } else {
                    // Regular input with enhanced placeholders and validation
                    const inputType = typeof value === 'number' ? 'number' : 'text';
                    const enhanced = (key === 'text' && node.title === '键盘') ? 'enhanced' : '';

                    // Enhanced placeholders and constraints
                    let placeholder = '';
                    let min = '';
                    let max = '';
                    let step = '';

                    if (inputType === 'number') {
                        step = 'step="0.1"';
                        switch(key) {
                            case 'x':
                            case 'y':
                                placeholder = 'placeholder="如: 500"';
                                min = 'min="0"';
                                max = 'max="3840"';
                                break;
                            case 'x_random':
                            case 'y_random':
                                placeholder = 'placeholder="如: 5 (±5像素)"';
                                min = 'min="0"';
                                max = 'max="100"';
                                break;
                            case 'duration':
                                placeholder = 'placeholder="如: 0.5"';
                                min = 'min="0.1"';
                                max = 'max="10"';
                                break;
                            case 'speed_factor':
                                placeholder = 'placeholder="如: 1.0 (正常速度)"';
                                min = 'min="0.1"';
                                max = 'max="5"';
                                break;
                            case 'confidence':
                                placeholder = 'placeholder="如: 0.8 (推荐)"';
                                min = 'min="0.1"';
                                max = 'max="1"';
                                step = 'step="0.1"';
                                break;
                            case 'clicks':
                                placeholder = 'placeholder="如: 3"';
                                min = 'min="1"';
                                max = 'max="10"';
                                step = 'step="1"';
                                break;
                        }
                    } else {
                        // Text input placeholders
                        switch(key) {
                            case 'text':
                                if (node.title === '键盘') {
                                    placeholder = 'placeholder="输入要发送的文本，如: Hello World"';
                                }
                                break;
                            case 'target_node_id':
                                placeholder = 'placeholder="目标节点的ID，如: 2"';
                                break;
                        }
                    }

                    inputHtml = `<input type="${inputType}" class="property-input ${enhanced}"
                           data-property="${key}"
                           value="${value || ''}"
                           ${placeholder}
                           ${min}
                           ${max}
                           ${step}
                           ${key.includes('image_path') ? 'readonly' : ''}">`;
                }
                
                // Add help text for complex properties
                let helpText = '';
                switch(key) {
                    case 'x_random':
                    case 'y_random':
                        helpText = '<div class="input-help-text">随机偏移可让点击更加自然，避免被检测</div>';
                        break;
                    case 'position_mode':
                        helpText = '<div class="input-help-text">绝对坐标：固定位置 | 当前位置：使用鼠标当前所在位置</div>';
                        break;
                    case 'duration':
                        helpText = '<div class="input-help-text">移动到目标位置所需的时间，越短越快</div>';
                        break;
                    case 'speed_factor':
                        helpText = '<div class="input-help-text">1.0=正常速度，2.0=两倍速度，0.5=一半速度</div>';
                        break;
                    case 'confidence':
                        helpText = '<div class="input-help-text">图像匹配的相似度阈值，0.8是推荐值</div>';
                        break;
                    case 'input_type':
                        if (node.title === '键盘') {
                            helpText = '<div class="input-help-text">文本：输入字符串 | 单键：单个按键 | 特殊键：功能键 | 组合键：Ctrl+C等</div>';
                        }
                        break;
                }

                html += `<div class="property-group">
                    <label class="property-label">${this.getPropertyLabel(key)}</label>
                    ${inputHtml}
                    ${helpText}
                </div>`;

                // Add upload button for image properties
                if (key.includes('image_path')) {
                    html += `<button class="btn btn-secondary" style="width: 100%; margin-top: 5px;" 
                             onclick="window.app.uiManager.showUploadModal(window.app.selectedNode)">
                             上传图像
                         </button>`;
                }
            });
        }

        content.innerHTML = html;

        // Bind property input events
        this.bindPropertyInputEvents(node, content);
    }

    bindPropertyInputEvents(node, content) {
        const inputs = content.querySelectorAll('.property-input[data-property]');
        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.handlePropertyChange(node, e);
            });

            // Also bind input event for real-time updates
            input.addEventListener('input', (e) => {
                this.handlePropertyChange(node, e, true);
            });
        });

        // Bind modifier key checkboxes
        const modifierCheckboxes = content.querySelectorAll('.modifier-checkbox input[type="checkbox"]');
        modifierCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleModifierKeyChange(node, content);
            });

            // Update visual state
            checkbox.addEventListener('change', function() {
                const label = this.closest('.modifier-checkbox');
                if (this.checked) {
                    label.classList.add('checked');
                } else {
                    label.classList.remove('checked');
                }
            });
        });

        // Bind key input suggestions
        const keyInputs = content.querySelectorAll('.key-input-container input');
        keyInputs.forEach(input => {
            this.setupKeyInputSuggestions(input);
        });
    }

    handlePropertyChange(node, event, isRealTime = false) {
        const property = event.target.dataset.property;
        let value = event.target.value;

        // Convert to number if needed
        if (event.target.type === 'number') {
            value = parseFloat(value) || 0;
        }

        // Enhanced validation for all inputs
        if (property === 'key' && node.title === '键盘') {
            const isValid = this.validateKeyInput(value);
            event.target.classList.toggle('error', !isValid);
            if (!isValid && !isRealTime) {
                this.showInputError(event.target, '请输入有效的按键名称，如: a, space, enter');
                return;
            }
        } else {
            // General property validation
            const validation = this.validatePropertyInput(property, value, node);
            event.target.classList.toggle('error', !validation.valid);
            if (!validation.valid && !isRealTime) {
                this.showInputError(event.target, validation.message);
                return;
            }
        }

        // Auto-correct invalid values for better UX
        if (property === 'hold_duration' && value < 0) {
            value = 0;
            event.target.value = value;
        }
        if ((property === 'x' || property === 'y') && value < 0) {
            value = 0;
            event.target.value = value;
        }
        if ((property === 'x_random' || property === 'y_random') && value < 0) {
            value = 0;
            event.target.value = value;
        }

        console.log(`Updating property ${property} to:`, value);
        node.properties[property] = value;
        
        // Trigger node's onPropertyChanged method if it exists
        if (typeof node.onPropertyChanged === 'function') {
            node.onPropertyChanged(property, value);
        }
        
        // Also trigger the node's updateWidgets method if it exists
        if (typeof node.updateWidgets === 'function') {
            node.updateWidgets();
        }
        
        // For certain properties that affect UI visibility, refresh the properties panel
        if ((property === 'position_mode' || property === 'input_type') && !isRealTime) {
            setTimeout(() => {
                this.updatePropertiesPanel(node);
            }, 50);
        }
        
        // Force canvas redraw to show changes on the node
        node.setDirtyCanvas(true, true);
        this.app.canvas.setDirty(true, true);
        
        // Trigger auto-save after property change
        if (window.drawingManager && window.drawingManager._triggerDelayedSave && !isRealTime) {
            window.drawingManager._triggerDelayedSave();
        }
    }

    getPropertyLabel(key) {
        const labels = {
            'x': 'X坐标 (像素)',
            'y': 'Y坐标 (像素)',
            'x_random': 'X随机偏移 (±像素)',
            'y_random': 'Y随机偏移 (±像素)',
            'duration': '移动时长 (秒)',
            'duration_random': '时长随机范围 (±秒)',
            'speed_factor': '速度倍数 (1.0=正常)',
            'speed_random': '速度随机范围 (±倍数)',
            'text': '要输入的文本内容',
            'key': '按键名称',
            'input_type': '键盘输入类型',
            'special_key': '特殊功能键',
            'modifier_keys': '修饰键组合',
            'hold_duration': '按键持续时长 (秒)',
            'position_mode': '坐标模式',
            'button': '鼠标按键类型',
            'direction': '滚轮方向',
            'clicks': '滚动次数',
            'image_path': '图像文件路径',
            'confidence': '图像匹配阈值 (0-1)',
            'condition_type': '判断条件类型',
            'target_node_id': '目标节点ID',
            'expected_result': '预期结果',
            'source_id': '源节点ID',
            'target_id': '目标节点ID',
            'output_type': '输出类型'
        };
        return labels[key] || key;
    }

    handleModifierKeyChange(node, content) {
        const checkboxes = content.querySelectorAll('.modifier-checkbox input[type="checkbox"]:checked');
        const selectedModifiers = Array.from(checkboxes).map(cb => cb.dataset.modifier);
        const modifierValue = selectedModifiers.join('+');

        // Update the hidden input
        const hiddenInput = content.querySelector('input[data-property="modifier_keys"]');
        if (hiddenInput) {
            hiddenInput.value = modifierValue;
            // Trigger change event
            hiddenInput.dispatchEvent(new Event('change'));
        }

        // Update node property
        node.properties.modifier_keys = modifierValue;

        // Update node widgets if available
        if (typeof node.updateWidgets === 'function') {
            node.updateWidgets();
        }

        // Force canvas redraw
        node.setDirtyCanvas(true, true);
        this.app.canvas.setDirty(true, true);

        // Trigger auto-save
        if (window.drawingManager && window.drawingManager._triggerDelayedSave) {
            window.drawingManager._triggerDelayedSave();
        }
    }

    setupKeyInputSuggestions(input) {
        const commonKeys = [
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
            'space', 'enter', 'tab', 'shift', 'ctrl', 'alt',
            'up', 'down', 'left', 'right', 'home', 'end',
            'backspace', 'delete', 'escape', 'insert'
        ];

        const suggestionsContainer = input.nextElementSibling;
        if (!suggestionsContainer || !suggestionsContainer.classList.contains('key-suggestions')) {
            return;
        }

        let selectedIndex = -1;

        const showSuggestions = (query) => {
            const filtered = commonKeys.filter(key =>
                key.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 8);

            if (filtered.length === 0 || (filtered.length === 1 && filtered[0].toLowerCase() === query.toLowerCase())) {
                suggestionsContainer.style.display = 'none';
                return;
            }

            suggestionsContainer.innerHTML = filtered.map((key, index) =>
                `<div class="key-suggestion ${index === selectedIndex ? 'selected' : ''}" data-key="${key}">${key}</div>`
            ).join('');

            suggestionsContainer.style.display = 'block';
            selectedIndex = -1;
        };

        const hideSuggestions = () => {
            suggestionsContainer.style.display = 'none';
            selectedIndex = -1;
        };

        const selectSuggestion = (key) => {
            input.value = key;
            input.dispatchEvent(new Event('change'));
            hideSuggestions();
            input.focus();
        };

        // Input events
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                showSuggestions(query);
            } else {
                hideSuggestions();
            }
        });

        input.addEventListener('focus', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                showSuggestions(query);
            }
        });

        input.addEventListener('blur', (e) => {
            // Delay hiding to allow clicks on suggestions
            setTimeout(() => hideSuggestions(), 150);
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const suggestions = suggestionsContainer.querySelectorAll('.key-suggestion');

            if (suggestions.length === 0) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                    updateSelectedSuggestion();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    updateSelectedSuggestion();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0) {
                        selectSuggestion(suggestions[selectedIndex].dataset.key);
                    }
                    break;
                case 'Escape':
                    hideSuggestions();
                    break;
            }
        });

        const updateSelectedSuggestion = () => {
            const suggestions = suggestionsContainer.querySelectorAll('.key-suggestion');
            suggestions.forEach((suggestion, index) => {
                suggestion.classList.toggle('selected', index === selectedIndex);
            });
        };

        // Click events on suggestions
        suggestionsContainer.addEventListener('click', (e) => {
            const suggestion = e.target.closest('.key-suggestion');
            if (suggestion) {
                selectSuggestion(suggestion.dataset.key);
            }
        });
    }

    validateKeyInput(value) {
        if (!value || value.trim() === '') return true; // Empty is valid

        const validKeys = [
            // Letters
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            // Numbers
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
            // Special keys
            'space', 'enter', 'tab', 'shift', 'ctrl', 'alt', 'cmd', 'win',
            'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
            'backspace', 'delete', 'escape', 'insert', 'capslock', 'numlock',
            'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
            // Symbols
            '`', '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/',
            '~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+',
            '{', '}', '|', ':', '"', '<', '>', '?'
        ];

        return validKeys.includes(value.toLowerCase().trim());
    }

    // Add comprehensive input validation for all node types
    validatePropertyInput(property, value, node) {
        const validationRules = {
            'x': { min: 0, max: 3840, type: 'number', message: 'X坐标应在 0-3840 范围内' },
            'y': { min: 0, max: 2160, type: 'number', message: 'Y坐标应在 0-2160 范围内' },
            'x_random': { min: 0, max: 100, type: 'number', message: 'X随机范围应在 0-100 范围内' },
            'y_random': { min: 0, max: 100, type: 'number', message: 'Y随机范围应在 0-100 范围内' },
            'duration': { min: 0.1, max: 10, type: 'number', message: '持续时间应在 0.1-10 秒范围内' },
            'speed_factor': { min: 0.1, max: 5, type: 'number', message: '速度因子应在 0.1-5 范围内' },
            'confidence': { min: 0.1, max: 1, type: 'number', message: '匹配度应在 0.1-1 范围内' },
            'clicks': { min: 1, max: 10, type: 'integer', message: '滚动次数应在 1-10 范围内' },
            'hold_duration': { min: 0, max: 5, type: 'number', message: '按键时长应在 0-5 秒范围内' }
        };

        const rule = validationRules[property];
        if (!rule) return { valid: true };

        if (rule.type === 'number' || rule.type === 'integer') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return { valid: false, message: `${property} 必须是数字` };
            }
            if (rule.type === 'integer' && !Number.isInteger(numValue)) {
                return { valid: false, message: `${property} 必须是整数` };
            }
            if (numValue < rule.min || numValue > rule.max) {
                return { valid: false, message: rule.message };
            }
        }

        return { valid: true };
    }

    showInputError(input, message) {
        // Remove existing error message
        const existingError = input.parentNode.querySelector('.input-error-message');
        if (existingError) {
            existingError.remove();
        }

        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'input-error-message';
        errorDiv.style.cssText = `
            color: var(--danger-color);
            font-size: 11px;
            margin-top: 4px;
            font-style: italic;
        `;
        errorDiv.textContent = message;

        // Insert after input
        input.parentNode.insertBefore(errorDiv, input.nextSibling);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 3000);
    }

    // 数据导入导出相关方法
    loadGraphFromData(data) {
        console.log('Loading graph from data:', data);
        this.app.graph.clear();
        
        if (!data.nodes || !Array.isArray(data.nodes)) {
            console.warn('No nodes data found in project');
            return;
        }

        console.log(`Loading ${data.nodes.length} nodes...`);

        // First pass: create all nodes
        const nodeMap = new Map();
        data.nodes.forEach((nodeData, index) => {
            console.log(`Creating node ${index + 1}: ${nodeData.id} (${nodeData.action_type})`);
            
            const node = this.addNodeToGraph(nodeData.action_type, [nodeData.x || 0, nodeData.y || 0], false);
            if (node) {
                // Store the original ID mapping
                nodeMap.set(nodeData.id, node);
                
                // Apply properties
                if (nodeData.params) {
                    Object.assign(node.properties, nodeData.params);
                    console.log(`Applied properties to node ${nodeData.id}:`, nodeData.params);
                    
                    if (typeof node.syncWidgets === 'function') {
                        node.syncWidgets();
                        console.log(`Synced widgets for node ${nodeData.id}`);
                    }
                }
                
                // Store original ID for reference
                node._original_id = nodeData.id;
                
                // Force node redraw to show loaded properties
                node.setDirtyCanvas(true, true);
            } else {
                console.error(`Failed to create node ${nodeData.id} of type ${nodeData.action_type}`);
            }
        });

        console.log(`Created ${nodeMap.size} nodes, now creating connections...`);

        // Second pass: recreate connections after all nodes are created
        this.recreateConnections(data.nodes, nodeMap);

        // Force canvas redraw
        this.app.canvas.setDirty(true, true);
        console.log(`Successfully loaded ${data.nodes.length} nodes`);
    }

    recreateConnections(nodes, nodeMap) {
        let connectionCount = 0;
        nodes.forEach(nodeData => {
            if (nodeData.connections && Array.isArray(nodeData.connections)) {
                const sourceNode = nodeMap.get(nodeData.id);
                
                nodeData.connections.forEach(connectionInfo => {
                    let targetNodeId, outputSlot = 0, inputSlot = 0;
                    
                    if (typeof connectionInfo === 'string') {
                        targetNodeId = connectionInfo;
                    } else if (typeof connectionInfo === 'object') {
                        targetNodeId = connectionInfo.target_id;
                        outputSlot = connectionInfo.output_slot || 0;
                        inputSlot = connectionInfo.input_slot || 0;
                    } else {
                        console.warn('Unknown connection format:', connectionInfo);
                        return;
                    }
                    
                    const targetNode = nodeMap.get(targetNodeId);
                    
                    if (sourceNode && targetNode) {
                        if (sourceNode.outputs && sourceNode.outputs[outputSlot] &&
                            targetNode.inputs && targetNode.inputs[inputSlot]) {
                            
                            try {
                                sourceNode.connect(outputSlot, targetNode, inputSlot);
                                connectionCount++;
                                console.log(`Connected ${sourceNode.title}[${outputSlot}] -> ${targetNode.title}[${inputSlot}]`);
                            } catch (error) {
                                console.warn(`Failed to connect ${sourceNode.title} -> ${targetNode.title}:`, error);
                            }
                        }
                    }
                });
            }
        });
        
        console.log(`Created ${connectionCount} connections`);
    }

    exportGraphData() {
        const nodes = [];
        
        this.app.graph._nodes.forEach(node => {
            const nodeData = {
                id: node.id.toString(),
                action_type: node.properties?.action_type || 'click',
                params: { ...node.properties },
                x: Math.round(node.pos[0]),
                y: Math.round(node.pos[1]),
                connections: []
            };
            
            // Remove internal properties
            delete nodeData.params.action_type;
            
            // Get connections with detailed information
            if (node.outputs) {
                node.outputs.forEach((output, outputIndex) => {
                    if (output.links) {
                        output.links.forEach(linkId => {
                            const link = this.app.graph.links[linkId];
                            if (link) {
                                const targetNode = this.app.graph.getNodeById(link.target_id);
                                if (targetNode) {
                                    nodeData.connections.push({
                                        target_id: targetNode.id.toString(),
                                        output_slot: outputIndex,
                                        input_slot: link.target_slot || 0
                                    });
                                }
                            }
                        });
                    }
                });
            }
            
            nodes.push(nodeData);
        });

        console.log('Exporting project data:', { nodes: nodes.length });
        
        return { nodes };
    }

    // Helper method to load a single node from data (used by drawing manager)
    loadNodeFromData(nodeData) {
        console.log(`Loading node: ${nodeData.id} (${nodeData.action_type})`);

        // Use position from nodeData if available, otherwise use default
        const position = [nodeData.pos ? nodeData.pos[0] : (nodeData.x || 0),
                         nodeData.pos ? nodeData.pos[1] : (nodeData.y || 0)];

        // Create node with predefined ID to maintain data consistency
        const node = this.addNodeToGraph(nodeData.action_type, position, false, nodeData.id);
        if (node) {
            console.log(`✅ Created node with unified ID: ${node.id}`);

            // Apply properties from params
            if (nodeData.params) {
                Object.assign(node.properties, nodeData.params);
                console.log(`Applied properties to node ${nodeData.id}:`, nodeData.params);

                if (typeof node.syncWidgets === 'function') {
                    node.syncWidgets();
                }
            }

            // Set node size if provided
            if (nodeData.size) {
                node.size[0] = nodeData.size[0];
                node.size[1] = nodeData.size[1];
            }

            // Store pending connections for later processing
            if (nodeData.connections && nodeData.connections.length > 0) {
                node._pendingConnections = nodeData.connections;
                console.log(`Stored ${nodeData.connections.length} pending connections for node ${nodeData.id}`);
            }

            // Force node redraw to show loaded properties
            node.setDirtyCanvas(true, true);

            return node;
        } else {
            console.error(`Failed to create node ${nodeData.id} of type ${nodeData.action_type}`);
            return null;
        }
    }

    markNodesWithMissingImage(deletedFilename) {
        // Check all nodes in the graph for references to the deleted image
        if (!this.app.graph || !this.app.graph._nodes) {
            console.warn('Graph or nodes not available');
            return;
        }
        
        this.app.graph._nodes.forEach(node => {
            if (node.properties && node.properties.image_path) {
                const filename = this.app.getFilenameFromPath(node.properties.image_path);
                if (filename === deletedFilename) {
                    // Mark this node as having a missing image
                    if (!node.flags) node.flags = {};
                    node.flags.missingImage = true;
                    node.setDirtyCanvas(true, true);
                    console.log(`Marked node "${node.title}" as having missing image: ${deletedFilename}`);
                }
            }
        });
    }

    // Helper method to serialize node data (for saving to drawings)
    serializeNodeToData(node) {
        const nodeData = {
            id: node.id.toString(),
            action_type: node.properties?.action_type || 'click',
            title: node.title,
            pos: [node.pos[0], node.pos[1]],
            size: [node.size[0], node.size[1]],
            params: {},
            connections: []
        };

        // Copy properties to params
        if (node.properties) {
            Object.keys(node.properties).forEach(key => {
                if (key !== 'action_type') { // Skip internal property
                    nodeData.params[key] = node.properties[key];
                }
            });
        }

        // Get output connections
        if (node.outputs && node.outputs.length > 0) {
            node.outputs.forEach((output) => {
                if (output.links && output.links.length > 0) {
                    output.links.forEach(linkId => {
                        const link = this.app.graph.links[linkId];
                        if (link && link.target_id) {
                            const targetNode = this.app.graph.getNodeById(link.target_id);
                            if (targetNode) {
                                const connectionId = targetNode.id.toString();
                                nodeData.connections.push(connectionId);
                                console.log(`Saving connection: ${node.id} -> ${connectionId}`);
                            }
                        }
                    });
                }
            });
        }

        return nodeData;
    }
}