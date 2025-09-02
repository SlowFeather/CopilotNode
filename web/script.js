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
        document.getElementById('loadProject').addEventListener('click', () => this.loadProject());
        document.getElementById('saveProject').addEventListener('click', () => this.saveProject());

        // Execution controls
        document.getElementById('playBtn').addEventListener('click', () => this.startExecution());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopExecution());
        
        // Speed slider
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        speedSlider.addEventListener('input', (e) => {
            speedValue.textContent = e.target.value + 'x';
        });

        // Node panel drag and drop
        this.initializeNodePanelDragDrop();

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
        const nodeItems = document.querySelectorAll('.node-item');
        nodeItems.forEach(item => {
            item.draggable = true;
            
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });

            item.addEventListener('click', () => {
                // Alternative: click to add node at center
                this.addNodeToGraph(item.dataset.type, [400, 300]);
            });
        });

        // Canvas drop handling
        const canvas = document.getElementById('graphCanvas');
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const nodeType = e.dataTransfer.getData('text/plain');
            if (nodeType) {
                const canvasPos = this.canvas.convertEventToCanvasOffset(e);
                this.addNodeToGraph(nodeType, [canvasPos[0], canvasPos[1]]);
            }
        });
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

    addNodeToGraph(nodeType, position) {
        const nodeClassName = `autoclick/${nodeType}`;
        const node = LiteGraph.createNode(nodeClassName);
        
        if (node) {
            node.pos = position;
            // Set action_type property to match backend expectations
            node.properties = node.properties || {};
            node.properties.action_type = nodeType;
            
            // Ensure default properties exist based on node type
            this.setDefaultProperties(node, nodeType);
            
            this.graph.add(node);
            this.canvas.selectNode(node);
            
            // Force update properties panel
            setTimeout(() => {
                this.selectedNode = node;
                this.updatePropertiesPanel(node);
            }, 100);
            
            return node;
        }
        return null;
    }

    setDefaultProperties(node, nodeType) {
        const defaults = {
            'click': { x: 0, y: 0, x_random: 0, y_random: 0 },
            'move': { x: 0, y: 0, duration: 0.2, duration_random: 0, speed_factor: 1.0, speed_random: 0 },
            'keyboard': { text: '', key: '' },
            'wait': { duration: 1.0 },
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
            content.innerHTML = '<div class="no-selection">请选择一个节点</div>';
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
                const inputType = typeof value === 'number' ? 'number' : 'text';
                
                html += `<div class="property-group">
                    <label class="property-label">${this.getPropertyLabel(key)}</label>
                    <input type="${inputType}" class="property-input" 
                           data-property="${key}" 
                           value="${value || ''}"
                           ${key.includes('image_path') ? 'readonly' : ''}
                           step="${inputType === 'number' ? '0.1' : ''}">
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
                
                // Force canvas redraw to show changes on the node
                node.setDirtyCanvas(true, true);
                this.canvas.setDirty(true, true);
            });

            // Also bind input event for real-time updates
            input.addEventListener('input', (e) => {
                const property = e.target.dataset.property;
                let value = e.target.value;
                
                if (e.target.type === 'number') {
                    value = parseFloat(value) || 0;
                }
                
                node.properties[property] = value;
                
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
                const projects = await response.json();
                const select = document.getElementById('projectSelect');
                
                // Clear existing options except first
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }
                
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project;
                    option.textContent = project;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load project list:', error);
        }
    }

    async loadProject() {
        const select = document.getElementById('projectSelect');
        const filename = select.value;
        
        if (!filename) {
            alert('请选择一个项目文件');
            return;
        }

        try {
            const response = await fetch(`/api/projects/${filename}`);
            if (response.ok) {
                const projectData = await response.json();
                this.loadGraphFromData(projectData);
                alert('项目加载成功');
            } else {
                alert('加载项目失败');
            }
        } catch (error) {
            console.error('Load project error:', error);
            alert('加载项目失败');
        }
    }

    async saveProject() {
        const filename = prompt('请输入项目文件名:');
        if (!filename) return;

        const projectData = this.exportGraphData();
        console.log('Saving project data:', projectData);

        try {
            // First sync the current graph data to backend
            await fetch('/api/nodes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            // Then save the project with filename
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename
                })
            });

            if (response.ok) {
                const result = await response.json();
                alert(`项目保存成功: ${result.filename}`);
                this.loadProjectList();
            } else {
                const error = await response.text();
                alert(`保存项目失败: ${error}`);
            }
        } catch (error) {
            console.error('Save project error:', error);
            alert('保存项目失败');
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
            
            const node = this.addNodeToGraph(nodeData.action_type, [nodeData.x || 0, nodeData.y || 0]);
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

    async startExecution() {
        // First sync the graph data to backend
        const graphData = this.exportGraphData();
        
        // Convert to backend-compatible format
        const backendData = {
            nodes: graphData.nodes.map(node => ({
                ...node,
                connections: node.connections.map(conn => 
                    typeof conn === 'string' ? conn : conn.target_id
                )
            }))
        };
        
        try {
            // Send graph data to backend
            await fetch('/api/nodes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(backendData)
            });

            // Start execution
            const loop = document.getElementById('loopCheck').checked;
            const speed = parseFloat(document.getElementById('speedSlider').value);
            
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ loop, speed })
            });

            if (response.ok) {
                this.updateExecutionUI(true);
            } else {
                const error = await response.json();
                alert(`执行失败: ${error.error}`);
            }
        } catch (error) {
            console.error('Execution error:', error);
            alert('执行失败');
        }
    }

    async stopExecution() {
        try {
            const response = await fetch('/api/execute', {
                method: 'DELETE'
            });

            if (response.ok) {
                this.updateExecutionUI(false);
            }
        } catch (error) {
            console.error('Stop execution error:', error);
        }
    }

    updateExecutionUI(isRunning) {
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        playBtn.disabled = isRunning;
        stopBtn.disabled = !isRunning;
        
        if (!isRunning) {
            this.executionStatus = {
                is_running: false,
                status: "idle",
                progress: 0,
                current_node: null,
                error: null
            };
            this.updateStatusPanel();
        }
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
                if (!status.is_running && (document.getElementById('playBtn').disabled || document.getElementById('stopBtn').disabled === false)) {
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
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CopilotNodeApp();
});