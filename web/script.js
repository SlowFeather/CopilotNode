// CopilotNode Web Application
class CopilotNodeApp {
    constructor() {
        this.graph = new LiteGraph.LGraph();
        this.canvas = null;
        this.selectedNode = null;
        this.executionStatus = {
            is_running: false,
            status: "idle",
            progress: 0,
            current_node: null,
            error: null
        };
        this.statusUpdateInterval = null;
        this.currentUploadNode = null;

        this.initializeCanvas();
        this.initializeEventListeners();
        this.loadProjectList();
        this.startStatusPolling();
    }

    // Helper method to get filename from path (handles both / and \ separators)
    getFilenameFromPath(path) {
        if (!path) return '';
        // Replace backslashes with forward slashes, then split and get last part
        return path.replace(/\\/g, '/').split('/').pop() || '';
    }

    // Check if image exists by testing if it can be loaded
    async checkImageExists(imagePath) {
        if (!imagePath) return false;
        
        const filename = this.getFilenameFromPath(imagePath);
        if (!filename) return false;
        
        try {
            const response = await fetch(`/api/images/${filename}`, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    initializeCanvas() {
        const canvas = document.getElementById("graphCanvas");
        this.canvas = new LiteGraph.LGraphCanvas(canvas, this.graph);
        
        // Configure canvas settings
        this.canvas.render_shadows = true;
        this.canvas.render_canvas_border = false;
        
        // Enable multi-selection support
        this.canvas.allow_dragcanvas = true;
        this.canvas.allow_dragnodes = true;
        this.canvas.multi_select = true;
        this.canvas.allow_reconnect_links = true;
        
        // Set grid background image
        this.canvas.background_image = "litegraph.js-release/editor/imgs/grid.png";
        
        // Initialize selection management
        this.selectedNodes = new Set();
        
        // Handle node selection
        this.canvas.onNodeSelected = (node) => {
            this.selectedNode = node;
            this.updatePropertiesPanel(node);
        };

        this.canvas.onNodeDeselected = () => {
            this.selectedNode = null;
            this.updatePropertiesPanel(null);
        };

        // Setup auto-save hooks for graph changes
        this.graph.onNodeAdded = (node) => {
            if (window.drawingManager && window.drawingManager._triggerDelayedSave) {
                window.drawingManager._triggerDelayedSave();
            }
        };

        this.graph.onNodeRemoved = (node) => {
            if (window.drawingManager && window.drawingManager._triggerDelayedSave) {
                window.drawingManager._triggerDelayedSave();
            }
        };

        // Enhanced mouse event handling for multi-selection
        this.canvas.onMouseDown = (e, localPos) => {
            // 验证和修复 localPos 参数
            if (!localPos || !Array.isArray(localPos) || localPos.length < 2) {
                // 如果 localPos 无效，尝试使用 graph_mouse 作为备选
                const graphMouse = this.canvas.graph_mouse;
                if (graphMouse && Array.isArray(graphMouse) && graphMouse.length >= 2) {
                    localPos = [graphMouse[0], graphMouse[1]];
                } else {
                    // 如果都无效，返回 false 让 LiteGraph 处理默认行为
                    return false;
                }
            }
            
            const node = this.graph.getNodeOnPos(localPos[0], localPos[1]);
            
            // Check if Ctrl key is pressed for multi-selection
            if (e.ctrlKey || e.metaKey) {
                if (node) {
                    // Toggle node selection
                    if (this.selectedNodes.has(node)) {
                        this.selectedNodes.delete(node);
                        node.selected = false;
                    } else {
                        this.selectedNodes.add(node);
                        node.selected = true;
                    }
                    
                    // Update primary selected node
                    this.selectedNode = node;
                    this.updatePropertiesPanel(node);
                    
                    console.log('Multi-select toggled:', node.title, 'Total selected:', this.selectedNodes.size);
                }
                // Force canvas redraw
                this.canvas.setDirty(true, true);
                // Prevent default LiteGraph behavior for multi-selection
                return true;
            } else {
                // Single selection mode
                if (node) {
                    // Clear previous multi-selection if not holding Ctrl
                    this.clearMultiSelection();
                    
                    // Select single node
                    this.selectedNodes.add(node);
                    node.selected = true;
                    this.selectedNode = node;
                    this.updatePropertiesPanel(node);
                    
                    console.log('Single select:', node.title);
                    
                    // Force canvas redraw
                    this.canvas.setDirty(true, true);
                    // Return false to allow LiteGraph to handle node dragging and other default behaviors
                    return false;
                } else {
                    // Clicked on empty space - clear all selections
                    this.clearMultiSelection();
                    this.selectedNode = null;
                    this.updatePropertiesPanel(null);
                    
                    // Force canvas redraw
                    this.canvas.setDirty(true, true);
                    // Return false to allow normal canvas interaction
                    return false;
                }
            }
        };
        
        // Handle mouse up for selection box
        this.canvas.onMouseUp = (e, localPos) => {
            // Force canvas redraw after any mouse interaction
            this.canvas.setDirty(true, true);
        };

        // Store last mouse position for multi-drag calculation
        const originalProcessMouseDown = this.canvas.processMouseDown;
        this.canvas.processMouseDown = (e) => {
            const mouse = this.canvas.graph_mouse;
            this.canvas.last_mouse_position = [mouse[0], mouse[1]];
            
            // Handle box selection start
            if ((e.ctrlKey || e.metaKey) && !this.graph.getNodeOnPos(mouse[0], mouse[1])) {
                this.canvas.box_selection_start = [mouse[0], mouse[1]];
                this.canvas.is_box_selecting = true;
                console.log('Started box selection at:', mouse);
                return true; // Prevent default canvas dragging
            }
            
            return originalProcessMouseDown.call(this.canvas, e);
        };
        
        // Handle box selection dragging and completion
        const originalProcessMouseUp = this.canvas.processMouseUp;
        this.canvas.processMouseUp = (e) => {
            if (this.canvas.is_box_selecting && this.canvas.box_selection_start) {
                const mouse = this.canvas.graph_mouse;
                const startPos = this.canvas.box_selection_start;
                
                // Only perform selection if we actually dragged
                const dragDistance = Math.sqrt(
                    Math.pow(mouse[0] - startPos[0], 2) + 
                    Math.pow(mouse[1] - startPos[1], 2)
                );
                
                if (dragDistance > 10) { // Minimum drag distance to avoid accidental selections
                    // Clear current selection if not holding Ctrl
                    if (!(e.ctrlKey || e.metaKey)) {
                        this.clearMultiSelection();
                    }
                    
                    // Select nodes in the box
                    this.selectNodesInBox(startPos, mouse);
                }
                
                // Clean up box selection state
                this.canvas.is_box_selecting = false;
                this.canvas.box_selection_start = null;
                this.canvas.box_selection_end = null;
                
                console.log('Completed box selection');
                return true;
            }
            
            return originalProcessMouseUp.call(this.canvas, e);
        };
        
        // Update box selection end position during drag
        const originalProcessMouseMoveForBox = this.canvas.processMouseMove;
        this.canvas.processMouseMove = (e) => {
            // Handle box selection visual feedback
            if (this.canvas.is_box_selecting && this.canvas.box_selection_start) {
                const mouse = this.canvas.graph_mouse;
                this.canvas.box_selection_end = [mouse[0], mouse[1]];
                this.canvas.setDirty(true, true); // Redraw to show selection box
                return true;
            }
            
            // Handle multi-node dragging
            if (this.canvas.dragging_canvas || !this.canvas.node_dragged) {
                return originalProcessMouseMoveForBox.call(this.canvas, e);
            }
            
            // If multiple nodes are selected and we're dragging one of them
            if (this.selectedNodes.size > 1 && this.selectedNodes.has(this.canvas.node_dragged)) {
                const draggedNode = this.canvas.node_dragged;
                const mouse = this.canvas.graph_mouse;
                const lastMouse = this.canvas.last_mouse_position;
                
                if (lastMouse) {
                    const deltaX = mouse[0] - lastMouse[0];
                    const deltaY = mouse[1] - lastMouse[1];
                    
                    // Move all selected nodes by the same delta
                    this.selectedNodes.forEach(node => {
                        if (node !== draggedNode) {
                            node.pos[0] += deltaX;
                            node.pos[1] += deltaY;
                        }
                    });
                    
                    console.log(`Multi-drag: Moving ${this.selectedNodes.size} nodes by (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`);
                }
            }
            
            return originalProcessMouseMoveForBox.call(this.canvas, e);
        };
        
        // Override render method to draw selection box
        const originalRender = this.canvas.render;
        this.canvas.render = function() {
            // Call original render first
            originalRender.call(this);
            
            // Draw selection box if active
            if (this.is_box_selecting && this.box_selection_start && this.box_selection_end) {
                const ctx = this.ctx;
                const start = this.box_selection_start;
                const end = this.box_selection_end;
                
                const x = Math.min(start[0], end[0]);
                const y = Math.min(start[1], end[1]);
                const width = Math.abs(end[0] - start[0]);
                const height = Math.abs(end[1] - start[1]);
                
                // Draw selection box
                ctx.save();
                ctx.strokeStyle = '#4a90e2';
                ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                
                // Fill and stroke the selection box
                ctx.fillRect(x, y, width, height);
                ctx.strokeRect(x, y, width, height);
                
                ctx.restore();
            }
        };

        // Auto-resize canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.querySelector('.canvas-container');
        const canvas = document.getElementById("graphCanvas");
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        this.canvas.resize();
    }

    // Multi-selection helper methods
    clearMultiSelection() {
        this.selectedNodes.forEach(node => {
            node.selected = false;
        });
        this.selectedNodes.clear();
        console.log('Cleared multi-selection');
    }
    
    selectNodesInBox(startPos, endPos) {
        const minX = Math.min(startPos[0], endPos[0]);
        const maxX = Math.max(startPos[0], endPos[0]);
        const minY = Math.min(startPos[1], endPos[1]);
        const maxY = Math.max(startPos[1], endPos[1]);
        
        let selectedCount = 0;
        
        this.graph._nodes.forEach(node => {
            const nodeX = node.pos[0];
            const nodeY = node.pos[1];
            const nodeWidth = node.size[0] || 150;
            const nodeHeight = node.size[1] || 80;
            
            // Check if node intersects with selection box
            if (nodeX < maxX && nodeX + nodeWidth > minX &&
                nodeY < maxY && nodeY + nodeHeight > minY) {
                
                this.selectedNodes.add(node);
                node.selected = true;
                selectedCount++;
            }
        });
        
        console.log(`Box selection: Selected ${selectedCount} nodes in box (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
        
        // Update properties panel with the last selected node
        if (selectedCount > 0) {
            const lastSelected = Array.from(this.selectedNodes).pop();
            this.selectedNode = lastSelected;
            this.updatePropertiesPanel(lastSelected);
        }
        
        this.canvas.setDirty(true, true);
    }
    
    selectAllNodes() {
        this.clearMultiSelection();
        
        this.graph._nodes.forEach(node => {
            this.selectedNodes.add(node);
            node.selected = true;
        });
        
        console.log(`Selected all ${this.selectedNodes.size} nodes`);
        
        // Update properties panel with the last node
        if (this.selectedNodes.size > 0) {
            const lastSelected = Array.from(this.selectedNodes).pop();
            this.selectedNode = lastSelected;
            this.updatePropertiesPanel(lastSelected);
        }
        
        this.canvas.setDirty(true, true);
    }
    
    deleteSelectedNodes() {
        if (this.selectedNodes.size === 0) return;
        
        const nodeCount = this.selectedNodes.size;
        
        // Remove nodes from graph
        this.selectedNodes.forEach(node => {
            this.graph.remove(node);
        });
        
        console.log(`Deleted ${nodeCount} selected nodes`);
        
        // Clear selection
        this.clearMultiSelection();
        this.selectedNode = null;
        this.updatePropertiesPanel(null);
        
        this.canvas.setDirty(true, true);
    }

    initializeEventListeners() {
        // Project controls
        document.getElementById('createProjectBtn').addEventListener('click', () => this.showCreateProjectModal());
        document.getElementById('loadProject').addEventListener('click', () => this.loadProject());
        document.getElementById('saveProject').addEventListener('click', () => this.saveProject());

        // Execution controls
        document.getElementById('playCurrentBtn').addEventListener('click', () => this.startCurrentExecution());
        document.getElementById('playAllBtn').addEventListener('click', () => this.startAllExecution());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopExecution());
        
        // Speed slider
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        speedSlider.addEventListener('input', (e) => {
            speedValue.textContent = e.target.value + 'x';
        });

        // Node panel drag and drop - delay to ensure DOM is ready
        setTimeout(() => {
            console.log('Attempting to initialize node panel drag and drop...');
            this.initializeNodePanelDragDrop();
        }, 500); // Increased delay to ensure DOM is fully ready

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => this.hideUploadModal());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Tab controls
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Upload area drag and drop
        this.initializeUploadArea();

        // Click outside modal to close
        document.getElementById('uploadModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('uploadModal')) {
                this.hideUploadModal();
            }
        });
        
        // Keyboard shortcuts for multi-selection
        document.addEventListener('keydown', (e) => {
            // Ctrl+A to select all nodes
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                this.selectAllNodes();
            }
            
            // Delete key to delete selected nodes
            if (e.key === 'Delete' && this.selectedNodes.size > 0) {
                e.preventDefault();
                this.deleteSelectedNodes();
            }
            
            // Escape key to clear selection
            if (e.key === 'Escape') {
                this.clearMultiSelection();
                this.selectedNode = null;
                this.updatePropertiesPanel(null);
            }
        });
    }

    initializeNodePanelDragDrop() {
        console.log('Initializing node panel drag and drop...');
        
        const nodeItems = document.querySelectorAll('.node-item');
        console.log(`Found ${nodeItems.length} node items`);
        console.log('Node items:', Array.from(nodeItems).map(item => ({
            element: item,
            dataType: item.dataset.type,
            text: item.textContent
        })));
        
        nodeItems.forEach(item => {
            item.draggable = true;
            
            item.addEventListener('dragstart', (e) => {
                console.log(`Drag started for: ${item.dataset.type}`);
                e.dataTransfer.setData('text/plain', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });

            item.addEventListener('click', () => {
                console.log(`Click on node item: ${item.dataset.type}`);
                // Alternative: click to add node at center
                this.addNodeToGraph(item.dataset.type, [400, 300]);
            });
        });

        // Canvas drop handling
        const canvas = document.getElementById('graphCanvas');
        if (!canvas) {
            console.error('Canvas not found!');
            return;
        }
        
        console.log('Setting up canvas drop handlers');
        
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', (e) => {
            console.log('Drop event on canvas');
            e.preventDefault();
            const nodeType = e.dataTransfer.getData('text/plain');
            console.log(`Dropped node type: ${nodeType}`);
            
            if (nodeType) {
                try {
                    const canvasPos = this.canvas.convertEventToCanvasOffset(e);
                    console.log(`Canvas position: ${canvasPos[0]}, ${canvasPos[1]}`);
                    this.addNodeToGraph(nodeType, [canvasPos[0], canvasPos[1]]);
                } catch (error) {
                    console.error('Error adding node to graph:', error);
                }
            }
        });
        
        console.log('Node panel drag and drop initialization complete');
    }

    initializeUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadFile(files[0]);
            }
        });
    }

    addNodeToGraph(nodeType, position, autoSelect = true) {
        // Check if we have a current drawing selected
        if (window.drawingManager && !window.drawingManager.currentDrawingId) {
            // Show friendly notification instead of alert
            this.showNotification('请先在左侧选择或创建一个画图才能添加节点！', 'warning');
            console.log('addNodeToGraph blocked: No drawing selected');
            return null;
        }

        console.log(`addNodeToGraph called: nodeType=${nodeType}, position=`, position);
        console.log('Drawing manager state:', {
            exists: !!window.drawingManager,
            currentDrawingId: window.drawingManager?.currentDrawingId
        });
        console.log('Available node types:', Object.keys(LiteGraph.registered_node_types || {}));

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
            
            this.graph.add(node);
            
            // Only select node if autoSelect is true (default for manual adds)
            if (autoSelect) {
                this.canvas.selectNode(node);
                
                // Force update properties panel
                setTimeout(() => {
                    this.selectedNode = node;
                    this.updatePropertiesPanel(node);
                }, 100);
            }
            
            console.log(`Added ${nodeType} node to current drawing:`, window.drawingManager?.currentDrawingId);
            
            return node;
        } else {
            console.error(`Failed to create node: ${nodeClassName}`);
            console.error('Node type not registered or creation failed');
            this.showNotification(`无法创建节点类型: ${nodeType}`, 'error');
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
                } else {
                    // Regular input
                    const inputType = typeof value === 'number' ? 'number' : 'text';
                    inputHtml = `<input type="${inputType}" class="property-input" 
                           data-property="${key}" 
                           value="${value || ''}"
                           ${key.includes('image_path') ? 'readonly' : ''}
                           step="${inputType === 'number' ? '0.1' : ''}">`;
                }
                
                html += `<div class="property-group">
                    <label class="property-label">${this.getPropertyLabel(key)}</label>
                    ${inputHtml}
                </div>`;

                // Add upload button for image properties
                if (key.includes('image_path')) {
                    html += `<button class="btn btn-secondary" style="width: 100%; margin-top: 5px;" 
                             onclick="window.app.showUploadModal(window.app.selectedNode)">
                             上传图像
                         </button>`;
                }
            });
        }

        content.innerHTML = html;

        // Bind property input events
        const inputs = content.querySelectorAll('.property-input[data-property]');
        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const property = e.target.dataset.property;
                let value = e.target.value;
                
                // Convert to number if needed
                if (e.target.type === 'number') {
                    value = parseFloat(value) || 0;
                }
                
                console.log(`Updating property ${property} to:`, value);
                node.properties[property] = value;
                
                // Trigger node's onPropertyChanged method if it exists
                if (typeof node.onPropertyChanged === 'function') {
                    node.onPropertyChanged(property, value);
                }
                
                // Also trigger the node's updateWidgets method if it exists (for dynamic UI changes)
                if (typeof node.updateWidgets === 'function') {
                    node.updateWidgets();
                }
                
                // For certain properties that affect UI visibility, refresh the properties panel
                if (property === 'position_mode') {
                    setTimeout(() => {
                        this.updatePropertiesPanel(node);
                    }, 50);
                }
                
                // Force canvas redraw to show changes on the node
                node.setDirtyCanvas(true, true);
                this.canvas.setDirty(true, true);
                
                // Trigger auto-save after property change
                if (window.drawingManager && window.drawingManager._triggerDelayedSave) {
                    window.drawingManager._triggerDelayedSave();
                }
            });

            // Also bind input event for real-time updates
            input.addEventListener('input', (e) => {
                const property = e.target.dataset.property;
                let value = e.target.value;
                
                if (e.target.type === 'number') {
                    value = parseFloat(value) || 0;
                }
                
                node.properties[property] = value;
                
                // Trigger node's onPropertyChanged method if it exists
                if (typeof node.onPropertyChanged === 'function') {
                    node.onPropertyChanged(property, value);
                }
                
                // Also trigger the node's updateWidgets method if it exists (for dynamic UI changes)
                if (typeof node.updateWidgets === 'function') {
                    node.updateWidgets();
                }
                
                // Force immediate redraw for real-time updates
                node.setDirtyCanvas(true, true);
                this.canvas.setDirty(true, true);
            });
        });
    }

    getPropertyLabel(key) {
        const labels = {
            'x': 'X坐标',
            'y': 'Y坐标',
            'x_random': 'X随机范围',
            'y_random': 'Y随机范围',
            'duration': '持续时间(秒)',
            'duration_random': '时间随机范围',
            'speed_factor': '速度因子',
            'speed_random': '速度随机范围',
            'text': '文本内容',
            'key': '按键',
            'position_mode': '位置模式',
            'button': '鼠标按键',
            'direction': '滚动方向',
            'clicks': '滚动次数',
            'image_path': '图像路径',
            'confidence': '匹配度',
            'condition_type': '条件类型',
            'target_node_id': '目标节点ID',
            'expected_result': '预期结果',
            'source_id': '源节点ID',
            'target_id': '目标节点ID',
            'output_type': '输出类型'
        };
        return labels[key] || key;
    }

    showUploadModal(node) {
        if (node) {
            this.currentUploadNode = node;
            this.selectedImagePath = null;
            
            // Reset tabs to show existing images first
            this.switchTab('existing');
            this.loadExistingImages();
            
            document.getElementById('uploadModal').style.display = 'flex';
        }
    }

    hideUploadModal() {
        document.getElementById('uploadModal').style.display = 'none';
        this.currentUploadNode = null;
        this.selectedImagePath = null;
        this.resetUploadArea();
    }

    resetUploadArea() {
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadArea').style.display = 'block';
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.uploadFile(file);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Show/hide tab content
        document.getElementById('existingTab').style.display = tabName === 'existing' ? 'block' : 'none';
        document.getElementById('uploadTab').style.display = tabName === 'upload' ? 'block' : 'none';
    }

    // Project modal methods
    showCreateProjectModal() {
        document.getElementById('createProjectModal').style.display = 'flex';
        // Clear form
        document.getElementById('newProjectName').value = '';
        document.getElementById('newProjectDescription').value = '';
        
        // Set up event listeners for this modal
        this.setupCreateProjectModalEvents();
    }

    hideCreateProjectModal() {
        document.getElementById('createProjectModal').style.display = 'none';
        // Clean up event listeners
        this.cleanupCreateProjectModalEvents();
    }

    setupCreateProjectModalEvents() {
        // Close button
        document.getElementById('closeCreateProjectModal').onclick = () => this.hideCreateProjectModal();
        
        // Cancel button  
        document.getElementById('cancelCreateProject').onclick = () => this.hideCreateProjectModal();
        
        // Create button
        document.getElementById('confirmCreateProject').onclick = () => this.createProject();
        
        // Close on background click
        document.getElementById('createProjectModal').onclick = (e) => {
            if (e.target === document.getElementById('createProjectModal')) {
                this.hideCreateProjectModal();
            }
        };
    }

    cleanupCreateProjectModalEvents() {
        document.getElementById('closeCreateProjectModal').onclick = null;
        document.getElementById('cancelCreateProject').onclick = null;
        document.getElementById('confirmCreateProject').onclick = null;
        document.getElementById('createProjectModal').onclick = null;
    }

    async createProject() {
        const name = document.getElementById('newProjectName').value.trim();
        const description = document.getElementById('newProjectDescription').value.trim();
        
        if (!name) {
            alert('请输入项目名称');
            return;
        }

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification(`项目创建成功: ${name}`, 'success');
                this.hideCreateProjectModal();
                await this.loadProjectList();
                
                // Optionally set as active project and load it
                if (result.project_id) {
                    const select = document.getElementById('projectSelect');
                    select.value = result.project_id;
                    await this.loadProject();
                }
            } else {
                const error = await response.json();
                alert(`创建项目失败: ${error.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('Create project error:', error);
            alert('创建项目失败');
        }
    }

    async loadExistingImages() {
        const container = document.getElementById('existingImages');
        container.innerHTML = '<div class="loading-text">加载中...</div>';

        try {
            const response = await fetch('/api/images');
            if (response.ok) {
                const images = await response.json();
                this.displayExistingImages(images);
            } else {
                container.innerHTML = '<div class="no-images">加载图片失败</div>';
            }
        } catch (error) {
            console.error('Load images error:', error);
            container.innerHTML = '<div class="no-images">加载图片失败</div>';
        }
    }

    displayExistingImages(images) {
        const container = document.getElementById('existingImages');
        
        if (images.length === 0) {
            container.innerHTML = '<div class="no-images">暂无上传的图片</div>';
            return;
        }

        const imageGrid = images.map(image => {
            const displayName = image.filename.length > 15 
                ? image.filename.substring(0, 15) + '...'
                : image.filename;
            
            const sizeKB = Math.round(image.size / 1024);
            
            return `
                <div class="image-item" data-path="${image.path}" data-filename="${image.filename}">
                    <div class="image-item-content" onclick="app.selectExistingImage('${image.path}', this.parentElement)">
                        <img class="image-preview" src="/api/images/${image.filename}" alt="${image.filename}" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjQwIiB5PSI0NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSI+Pz88L3RleHQ+Cjwvc3ZnPg=='" />
                        <div class="image-name">${displayName}</div>
                        <div class="image-size">${sizeKB} KB</div>
                    </div>
                    <button class="delete-image-btn" onclick="app.confirmDeleteImage('${image.filename}', event)" title="删除图片">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            ${imageGrid}
            <button class="select-button" onclick="app.useSelectedImage()" disabled id="selectBtn">
                选择图片
            </button>
        `;
    }

    selectExistingImage(imagePath, element) {
        // Remove previous selection
        document.querySelectorAll('.image-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Select current image
        element.classList.add('selected');
        this.selectedImagePath = imagePath;

        // Enable select button
        document.getElementById('selectBtn').disabled = false;
    }

    useSelectedImage() {
        if (!this.selectedImagePath || !this.currentUploadNode) return;

        // Store the selected path before modal is closed
        const selectedPath = this.selectedImagePath;

        // Update node property
        this.currentUploadNode.properties.image_path = selectedPath;
        
        // Clear missing image flag if it was set
        if (this.currentUploadNode.flags && this.currentUploadNode.flags.missingImage) {
            this.currentUploadNode.flags.missingImage = false;
        }
        
        // Refresh properties panel
        this.updatePropertiesPanel(this.currentUploadNode);
        
        // Force node redraw to show updated image info
        this.currentUploadNode.setDirtyCanvas(true, true);
        this.canvas.setDirty(true, true);
        
        // Close modal
        this.hideUploadModal();
        
        const filename = this.getFilenameFromPath(selectedPath);
        alert(`已选择图像: ${filename}`);
    }

    confirmDeleteImage(filename, event) {
        // Prevent triggering parent click events
        event.stopPropagation();
        
        if (confirm(`确定要删除图片 "${filename}" 吗？\n\n注意：删除后，所有引用此图片的节点将失效。`)) {
            this.deleteImage(filename);
        }
    }

    async deleteImage(filename) {
        try {
            const response = await fetch(`/api/images/${filename}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert(`图片删除成功: ${filename}`);
                
                // Mark all nodes with this image path as having missing images
                this.markNodesWithMissingImage(filename);
                
                // Refresh the images list
                this.loadExistingImages();
                
                // Reset selection if the deleted image was selected
                if (this.selectedImagePath && this.selectedImagePath.includes(filename)) {
                    this.selectedImagePath = null;
                    document.getElementById('selectBtn').disabled = true;
                }
                
                // Mark all canvas as dirty to refresh node displays
                this.canvas.setDirty(true, true);
                
            } else {
                const error = await response.json();
                alert(`删除失败: ${error.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('Delete image error:', error);
            alert('删除图片时发生错误');
        }
    }

    markNodesWithMissingImage(deletedFilename) {
        // Check all nodes in the graph for references to the deleted image
        if (!this.graph || !this.graph._nodes) {
            console.warn('Graph or nodes not available');
            return;
        }
        
        this.graph._nodes.forEach(node => {
            if (node.properties && node.properties.image_path) {
                const filename = this.getFilenameFromPath(node.properties.image_path);
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

    async uploadFile(file) {
        if (!this.currentUploadNode) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('请选择图像文件 (PNG, JPG, JPEG)');
            return;
        }

        // Show upload progress
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'block';

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                
                // Update node property
                this.currentUploadNode.properties.image_path = result.path;
                
                // Clear missing image flag if it was set
                if (this.currentUploadNode.flags && this.currentUploadNode.flags.missingImage) {
                    this.currentUploadNode.flags.missingImage = false;
                }
                
                // Refresh properties panel
                this.updatePropertiesPanel(this.currentUploadNode);
                
                // Force node redraw to show updated image info
                this.currentUploadNode.setDirtyCanvas(true, true);
                this.canvas.setDirty(true, true);
                
                // Close modal
                this.hideUploadModal();
                
                if (result.duplicate) {
                    alert(`${result.message}: ${result.filename}`);
                } else {
                    alert(`图像上传成功: ${result.filename}`);
                }
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('图像上传失败，请重试');
            this.resetUploadArea();
        }
    }

    async loadProjectList() {
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                const projects = data.projects || [];
                const select = document.getElementById('projectSelect');
                
                // Clear existing options except first
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }
                
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load project list:', error);
        }
    }

    async loadProject() {
        const select = document.getElementById('projectSelect');
        const projectId = select.value;
        
        if (!projectId) {
            alert('请选择一个项目');
            return;
        }

        try {
            // Set the active project
            const setActiveResponse = await fetch(`/api/projects/${projectId}/activate`, {
                method: 'POST'
            });
            
            if (setActiveResponse.ok) {
                // Refresh drawing manager to load project drawings
                if (window.drawingManager) {
                    await window.drawingManager.checkAndLoadDrawings();
                }
                this.showNotification('项目加载成功', 'success');
            } else {
                alert('加载项目失败');
            }
        } catch (error) {
            console.error('Load project error:', error);
            alert('加载项目失败');
        }
    }

    async saveProject() {
        // In the new architecture, projects are managed through the drawing manager
        // This method now saves the current drawing instead of the entire project
        if (window.drawingManager && window.drawingManager.currentDrawingId) {
            await window.drawingManager.saveCurrentDrawing();
            this.showNotification('当前画图已保存', 'success');
        } else {
            alert('没有选择的画图需要保存');
        }
    }

    loadGraphFromData(data) {
        console.log('Loading graph from data:', data);
        this.graph.clear();
        
        if (!data.nodes || !Array.isArray(data.nodes)) {
            console.warn('No nodes data found in project');
            return;
        }

        console.log(`Loading ${data.nodes.length} nodes...`);

        // First pass: create all nodes
        const nodeMap = new Map();
        data.nodes.forEach((nodeData, index) => {
            console.log(`Creating node ${index + 1}: ${nodeData.id} (${nodeData.action_type})`);
            
            const node = this.addNodeToGraph(nodeData.action_type, [nodeData.x || 0, nodeData.y || 0], false); // Don't auto-select when loading from file
            if (node) {
                // Store the original ID mapping
                nodeMap.set(nodeData.id, node);
                
                // Apply properties
                if (nodeData.params) {
                    Object.assign(node.properties, nodeData.params);
                    console.log(`Applied properties to node ${nodeData.id}:`, nodeData.params);
                    
                    // 手动同步 widgets 值（如果节点支持）
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
        let connectionCount = 0;
        data.nodes.forEach(nodeData => {
            if (nodeData.connections && Array.isArray(nodeData.connections)) {
                const sourceNode = nodeMap.get(nodeData.id);
                
                nodeData.connections.forEach(connectionInfo => {
                    // Handle both old format (string) and new format (object)
                    let targetNodeId, outputSlot = 0, inputSlot = 0;
                    
                    if (typeof connectionInfo === 'string') {
                        // Old format: just target ID
                        targetNodeId = connectionInfo;
                        console.log(`Processing old format connection: ${nodeData.id} -> ${targetNodeId}`);
                    } else if (typeof connectionInfo === 'object') {
                        // New format: object with detailed slot info
                        targetNodeId = connectionInfo.target_id;
                        outputSlot = connectionInfo.output_slot || 0;
                        inputSlot = connectionInfo.input_slot || 0;
                        console.log(`Processing new format connection: ${nodeData.id}[${outputSlot}] -> ${targetNodeId}[${inputSlot}]`);
                    } else {
                        console.warn('Unknown connection format:', connectionInfo);
                        return;
                    }
                    
                    const targetNode = nodeMap.get(targetNodeId);
                    
                    if (sourceNode && targetNode) {
                        // Ensure the slots exist
                        if (sourceNode.outputs && sourceNode.outputs[outputSlot] &&
                            targetNode.inputs && targetNode.inputs[inputSlot]) {
                            
                            try {
                                sourceNode.connect(outputSlot, targetNode, inputSlot);
                                connectionCount++;
                                console.log(`Connected ${sourceNode.title}[${outputSlot}] -> ${targetNode.title}[${inputSlot}]`);
                            } catch (error) {
                                console.warn(`Failed to connect ${sourceNode.title} -> ${targetNode.title}:`, error);
                            }
                        } else {
                            console.warn(`Slot mismatch: ${sourceNode.title}[${outputSlot}] -> ${targetNode.title}[${inputSlot}]`);
                            console.warn('Source outputs:', sourceNode.outputs?.length, 'Target inputs:', targetNode.inputs?.length);
                        }
                    } else {
                        console.warn(`Failed to find nodes for connection: ${nodeData.id} -> ${targetNodeId}`);
                        console.warn('Available nodes:', Array.from(nodeMap.keys()));
                    }
                });
            }
        });

        // Force canvas redraw
        this.canvas.setDirty(true, true);
        console.log(`Successfully loaded ${data.nodes.length} nodes with ${connectionCount} connections`);
    }

    exportGraphData() {
        const nodes = [];
        
        this.graph._nodes.forEach(node => {
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
            
            // Debug: Log move node params specifically
            if (nodeData.action_type === 'move') {
                console.log(`DEBUG: Move node ${node.id} export params:`, nodeData.params);
                console.log(`DEBUG: Move node original properties:`, node.properties);
            }
            
            // Get connections with detailed information
            if (node.outputs) {
                node.outputs.forEach((output, outputIndex) => {
                    if (output.links) {
                        output.links.forEach(linkId => {
                            const link = this.graph.links[linkId];
                            if (link) {
                                const targetNode = this.graph.getNodeById(link.target_id);
                                if (targetNode) {
                                    // Use new format for consistency with test projects
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

        // Also include links information for debugging
        const links = {};
        Object.keys(this.graph.links).forEach(linkId => {
            const link = this.graph.links[linkId];
            if (link) {
                links[linkId] = {
                    origin_id: link.origin_id,
                    origin_slot: link.origin_slot,
                    target_id: link.target_id,
                    target_slot: link.target_slot
                };
            }
        });

        console.log('Exporting project data:', { nodes: nodes.length, links: Object.keys(links).length });
        console.log('Exported nodes:', nodes.map(n => ({ id: n.id, type: n.action_type, connections: n.connections.length })));
        
        return { 
            nodes,
            _debug: {
                links,
                timestamp: new Date().toISOString()
            }
        };
    }

    async startCurrentExecution() {
        // Check if current drawing is selected
        if (!window.drawingManager || !window.drawingManager.currentDrawingId) {
            alert('请先选择要执行的画图');
            return;
        }

        try {
            // Execute the current drawing
            const loop = document.getElementById('loopCheck').checked;
            const speed = parseFloat(document.getElementById('speedSlider').value);
            
            const response = await fetch(`/api/drawings/${window.drawingManager.currentDrawingId}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ loop, speed })
            });

            if (response.ok) {
                this.updateExecutionUI(true, 'current');
            } else {
                const error = await response.json();
                alert(`执行当前画图失败: ${error.error}`);
            }
        } catch (error) {
            console.error('Current execution error:', error);
            alert('执行当前画图失败');
        }
    }

    async startAllExecution() {
        // Check if there are any drawings in the current project
        if (!window.drawingManager || !window.drawingManager.drawings || window.drawingManager.drawings.size === 0) {
            alert('当前项目中没有画图，请先创建画图');
            return;
        }

        try {
            // Execute all drawings in the current project
            const loop = document.getElementById('loopCheck').checked;
            const speed = parseFloat(document.getElementById('speedSlider').value);
            
            const response = await fetch('/api/drawings/execute-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ loop, speed })
            });

            if (response.ok) {
                this.updateExecutionUI(true, 'all');
            } else {
                const error = await response.json();
                alert(`执行全部画图失败: ${error.error}`);
            }
        } catch (error) {
            console.error('All execution error:', error);
            alert('执行全部画图失败');
        }
    }

    async stopExecution() {
        try {
            let endpoint = '/api/execute';
            
            // Use specific endpoint based on execution type
            if (this.currentExecutionType === 'current' && window.drawingManager && window.drawingManager.currentDrawingId) {
                endpoint = `/api/drawings/${window.drawingManager.currentDrawingId}/execute`;
            } else if (this.currentExecutionType === 'all') {
                endpoint = '/api/drawings/execute-all';
            }
            
            const response = await fetch(endpoint, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.updateExecutionUI(false);
            }
        } catch (error) {
            console.error('Stop execution error:', error);
        }
    }

    updateExecutionUI(isRunning, executionType = null) {
        const playCurrentBtn = document.getElementById('playCurrentBtn');
        const playAllBtn = document.getElementById('playAllBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        playCurrentBtn.disabled = isRunning;
        playAllBtn.disabled = isRunning;
        stopBtn.disabled = !isRunning;
        
        if (isRunning && executionType) {
            // Update button appearance to show which mode is running
            if (executionType === 'current') {
                playCurrentBtn.style.background = 'linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 193, 7, 0.2))';
                playCurrentBtn.style.borderColor = 'rgba(255, 193, 7, 0.6)';
            } else if (executionType === 'all') {
                playAllBtn.style.background = 'linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 193, 7, 0.2))';
                playAllBtn.style.borderColor = 'rgba(255, 193, 7, 0.6)';
            }
        } else if (!isRunning) {
            // Reset button appearance
            playCurrentBtn.style.background = '';
            playCurrentBtn.style.borderColor = '';
            playAllBtn.style.background = '';
            playAllBtn.style.borderColor = '';
            
            this.executionStatus = {
                is_running: false,
                status: "idle",
                progress: 0,
                current_node: null,
                error: null
            };
            this.updateStatusPanel();
        }
        
        // Store execution type for status updates
        this.currentExecutionType = isRunning ? executionType : null;
    }

    startStatusPolling() {
        this.statusUpdateInterval = setInterval(() => {
            this.updateStatus();
        }, 500);
    }

    async updateStatus() {
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                const status = await response.json();
                this.executionStatus = status;
                this.updateStatusPanel();
                
                // Update execution UI if status changed
                const playCurrentBtn = document.getElementById('playCurrentBtn');
                const playAllBtn = document.getElementById('playAllBtn');
                const stopBtn = document.getElementById('stopBtn');
                
                if (!status.is_running && ((playCurrentBtn && playCurrentBtn.disabled) || (playAllBtn && playAllBtn.disabled) || (stopBtn && stopBtn.disabled === false))) {
                    this.updateExecutionUI(false);
                }
            }
        } catch (error) {
            console.error('Status update error:', error);
        }
    }

    updateStatusPanel() {
        const status = this.executionStatus;
        
        document.getElementById('statusText').textContent = this.getStatusText(status.status);
        document.getElementById('progressBar').style.width = `${status.progress}%`;
        document.getElementById('progressText').textContent = `${status.progress}%`;
        document.getElementById('currentNode').textContent = status.current_node || '无';
        
        const errorItem = document.getElementById('errorItem');
        if (status.error) {
            errorItem.style.display = 'flex';
            document.getElementById('errorText').textContent = status.error;
        } else {
            errorItem.style.display = 'none';
        }
    }

    getStatusText(status) {
        const statusMap = {
            'idle': '空闲',
            'running': '运行中',
            'stopping': '停止中',
            'completed': '已完成',
            'error': '错误'
        };
        return statusMap[status] || status;
    }

    // Debug function to validate project data
    validateProjectData() {
        const data = this.exportGraphData();
        console.log('=== Project Data Validation ===');
        console.log('Nodes:', data.nodes.length);
        
        data.nodes.forEach(node => {
            console.log(`Node ${node.id} (${node.action_type}):`, {
                position: [node.x, node.y],
                properties: Object.keys(node.params).length,
                connections: node.connections.length
            });
            
            node.connections.forEach(conn => {
                console.log(`  -> ${typeof conn === 'string' ? conn : conn.target_id}`);
            });
        });
        
        return data;
    }

    showNotification(message, type = 'info', duration = 3000) 
    {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '10000',
            maxWidth: '400px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        // Set background color based on type
        const colors = {
            info: '#007bff',
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // Helper method to serialize node data (for saving to drawings)
    serializeNodeToData(node) 
    {
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
                        const link = this.graph.links[linkId];
                        if (link && link.target_id) {
                            const targetNode = this.graph.getNodeById(link.target_id);
                            if (targetNode) {
                                // Since we now force runtime ID to match original ID, we can just use the ID
                                const connectionId = targetNode.id.toString();
                                nodeData.connections.push(connectionId);
                                console.log(`💾 Saving connection: ${node.id} -> ${connectionId}`);
                            } else {
                                console.warn(`❌ Target node ${link.target_id} not found for link ${linkId}`);
                            }
                        }
                    });
                }
            });
        }

        return nodeData;
    }

    // Helper method to load a single node from data (used by drawing manager)
    loadNodeFromData(nodeData) {
        console.log(`Loading node: ${nodeData.id} (${nodeData.action_type})`);
        
        // Use position from nodeData if available, otherwise use default
        const position = [nodeData.pos ? nodeData.pos[0] : (nodeData.x || 0), 
                         nodeData.pos ? nodeData.pos[1] : (nodeData.y || 0)];
        
        const node = this.addNodeToGraph(nodeData.action_type, position, false); // Don't auto-select when loading
        if (node) {
            // Store original ID for reference
            node._original_id = nodeData.id;
            
            // Force node ID to match the saved ID to prevent connection issues
            const savedId = parseInt(nodeData.id);
            const oldId = node.id;
            
            // Only update ID if it's different (should be rare now with pre-set counter)
            if (oldId !== savedId) {
                // Remove node from old ID mapping
                if (this.graph._nodes_by_id && this.graph._nodes_by_id[oldId]) {
                    delete this.graph._nodes_by_id[oldId];
                }
                
                // Set new ID and update mapping
                node.id = savedId;
                if (this.graph._nodes_by_id) {
                    this.graph._nodes_by_id[savedId] = node;
                }
                
                console.log(`🔧 Corrected node ID: ${oldId} -> ${savedId}`);
            } else {
                console.log(`✅ Node ID already correct: ${savedId}`);
            }
            
            // Apply properties from params
            if (nodeData.params) {
                Object.assign(node.properties, nodeData.params);
                console.log(`Applied properties to node ${nodeData.id}:`, nodeData.params);
                
                // Manually sync widgets if node supports it
                if (typeof node.syncWidgets === 'function') {
                    node.syncWidgets();
                    console.log(`Synced widgets for node ${nodeData.id}`);
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
                console.log(`📋 Stored ${nodeData.connections.length} pending connections for node ${nodeData.id}:`, nodeData.connections);
            } else {
                console.log(`📭 No connections to store for node ${nodeData.id}`);
            }
            
            // Force node redraw to show loaded properties
            node.setDirtyCanvas(true, true);
            
            return node;
        } else {
            console.error(`Failed to create node ${nodeData.id} of type ${nodeData.action_type}`);
            return null;
        }
    }
}

// Global functions for HTML onclick handlers
window.showUploadModal = function(node) {
    if (window.app) {
        window.app.showUploadModal(node);
    }
};

// Global debug functions
window.debugProject = function() {
    if (window.app) {
        return window.app.validateProjectData();
    }
};

window.testSaveLoad = function() {
    if (window.app) {
        console.log('=== Testing save/load functionality ===');
        
        // Export current data
        const exportedData = window.app.exportGraphData();
        console.log('1. Exported data:', exportedData);
        console.log('2. Node count:', exportedData.nodes.length);
        
        exportedData.nodes.forEach(node => {
            console.log(`   Node ${node.id}: ${node.action_type}, connections: ${node.connections.length}`);
        });
        
        if (exportedData.nodes.length === 0) {
            console.warn('No nodes found! Please create some nodes first.');
            return 'No nodes to test with. Create some nodes first.';
        }
        
        // Clear and reload
        console.log('3. Clearing current graph...');
        window.app.graph.clear();
        
        console.log('4. Reloading from exported data...');
        window.app.loadGraphFromData(exportedData);
        
        console.log('5. Verifying reload...');
        const reloadedData = window.app.exportGraphData();
        console.log('6. Reloaded data:', reloadedData);
        
        // Compare
        const originalNodeCount = exportedData.nodes.length;
        const reloadedNodeCount = reloadedData.nodes.length;
        
        console.log(`7. Comparison: Original ${originalNodeCount} nodes, Reloaded ${reloadedNodeCount} nodes`);
        
        if (originalNodeCount === reloadedNodeCount) {
            console.log('✅ Test PASSED - Node count matches');
            return 'Test PASSED - check console for details';
        } else {
            console.error('❌ Test FAILED - Node count mismatch');
            return 'Test FAILED - check console for details';
        }
    }
};

// New function to test actual save/load with backend
window.testSaveLoadBackend = async function() {
    if (window.app) {
        console.log('=== Testing backend save/load functionality ===');
        
        const testFilename = 'test_save_load_' + Date.now() + '.json';
        
        try {
            // Get current data
            const originalData = window.app.exportGraphData();
            console.log('1. Original data:', originalData);
            
            if (originalData.nodes.length === 0) {
                console.warn('No nodes found! Please create some nodes first.');
                return 'No nodes to test with. Create some nodes first.';
            }
            
            // Save project
            console.log('2. Saving project...');
            await fetch('/api/nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(originalData)
            });
            
            const saveResponse = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: testFilename })
            });
            
            if (!saveResponse.ok) {
                throw new Error('Save failed: ' + await saveResponse.text());
            }
            
            console.log('3. Project saved successfully');
            
            // Clear current graph
            console.log('4. Clearing graph...');
            window.app.graph.clear();
            
            // Load project back
            console.log('5. Loading project back...');
            const loadResponse = await fetch(`/api/projects/${testFilename}`);
            
            if (!loadResponse.ok) {
                throw new Error('Load failed: ' + await loadResponse.text());
            }
            
            const loadedData = await loadResponse.json();
            console.log('6. Loaded data:', loadedData);
            
            // Apply loaded data
            window.app.loadGraphFromData(loadedData);
            
            // Verify
            const finalData = window.app.exportGraphData();
            console.log('7. Final data after reload:', finalData);
            
            // Compare
            const originalNodeCount = originalData.nodes.length;
            const finalNodeCount = finalData.nodes.length;
            
            console.log(`8. Comparison: Original ${originalNodeCount} nodes, Final ${finalNodeCount} nodes`);
            
            if (originalNodeCount === finalNodeCount) {
                console.log('✅ Backend test PASSED');
                return `Backend test PASSED (${testFilename})`;
            } else {
                console.error('❌ Backend test FAILED - Node count mismatch');
                return 'Backend test FAILED - check console for details';
            }
            
        } catch (error) {
            console.error('Backend test error:', error);
            return 'Backend test ERROR - check console for details';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CopilotNodeApp();
});
