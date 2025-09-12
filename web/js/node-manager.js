// 节点管理模块 - 负责节点的创建、属性管理和数据导入导出
class NodeManager {
    constructor(app) {
        this.app = app;
    }

    addNodeToGraph(nodeType, position, autoSelect = true) {
        // Check if we have a current drawing selected
        if (window.drawingManager && !window.drawingManager.currentDrawingId) {
            this.app.showNotification('请先在左侧选择或创建一个画图才能添加节点！', 'warning');
            console.log('addNodeToGraph blocked: No drawing selected');
            return null;
        }

        console.log(`addNodeToGraph called: nodeType=${nodeType}, position=`, position);
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
            
            this.app.graph.add(node);
            
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
    }

    handlePropertyChange(node, event, isRealTime = false) {
        const property = event.target.dataset.property;
        let value = event.target.value;
        
        // Convert to number if needed
        if (event.target.type === 'number') {
            value = parseFloat(value) || 0;
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
        if (property === 'position_mode' && !isRealTime) {
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
        
        const node = this.addNodeToGraph(nodeData.action_type, position, false);
        if (node) {
            // Store original ID for reference
            node._original_id = nodeData.id;
            
            // Force node ID to match the saved ID to prevent connection issues
            const savedId = parseInt(nodeData.id);
            const oldId = node.id;
            
            // Only update ID if it's different
            if (oldId !== savedId) {
                if (this.app.graph._nodes_by_id && this.app.graph._nodes_by_id[oldId]) {
                    delete this.app.graph._nodes_by_id[oldId];
                }
                
                node.id = savedId;
                if (this.app.graph._nodes_by_id) {
                    this.app.graph._nodes_by_id[savedId] = node;
                }
                
                console.log(`Corrected node ID: ${oldId} -> ${savedId}`);
            }
            
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