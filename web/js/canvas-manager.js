// 画布管理模块 - 负责LiteGraph画布的初始化和交互
class CanvasManager {
    constructor(app) {
        this.app = app;
    }

    initializeCanvas() {
        const canvas = document.getElementById("graphCanvas");
        this.app.canvas = new LiteGraph.LGraphCanvas(canvas, this.app.graph);
        
        // Configure canvas settings
        this.app.canvas.render_shadows = true;
        this.app.canvas.render_canvas_border = false;
        
        // Enable multi-selection support
        this.app.canvas.allow_dragcanvas = true;
        this.app.canvas.allow_dragnodes = true;
        this.app.canvas.multi_select = false;
        this.app.canvas.allow_reconnect_links = true;
        
        // Set grid background image
        this.app.canvas.background_image = "litegraph.js-release/editor/imgs/grid.png";
        
        // Handle node selection
        this.app.canvas.onNodeSelected = (node) => {
            this.app.selectedNode = node;
            this.app.nodeManager.updatePropertiesPanel(node);
        };

        this.app.canvas.onNodeDeselected = () => {
            this.app.selectedNode = null;
            this.app.nodeManager.updatePropertiesPanel(null);
        };

        // Setup auto-save hooks for graph changes
        this.app.graph.onNodeAdded = (node) => {
            if (window.drawingManager && window.drawingManager._triggerDelayedSave) {
                window.drawingManager._triggerDelayedSave();
            }
        };

        this.app.graph.onNodeRemoved = (node) => {
            if (window.drawingManager && window.drawingManager._triggerDelayedSave) {
                window.drawingManager._triggerDelayedSave();
            }
        };

        // 设置鼠标事件处理
        this.setupMouseEvents();
        
        // Auto-resize canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    setupMouseEvents() {
        // Enhanced mouse event handling for multi-selection
        this.app.canvas.onMouseDown = (e, localPos) => {
            // 验证和修复 localPos 参数
            if (!localPos || !Array.isArray(localPos) || localPos.length < 2) {
                const graphMouse = this.app.canvas.graph_mouse;
                if (graphMouse && Array.isArray(graphMouse) && graphMouse.length >= 2) {
                    localPos = [graphMouse[0], graphMouse[1]];
                } else {
                    return false;
                }
            }
            
            const node = this.app.graph.getNodeOnPos(localPos[0], localPos[1]);
            
            // Check if Ctrl key is pressed for multi-selection
            if (e.ctrlKey || e.metaKey) {
                if (node) {
                    // Toggle node selection
                    if (this.app.selectedNodes.has(node)) {
                        this.app.selectedNodes.delete(node);
                        node.selected = false;
                    } else {
                        this.app.selectedNodes.add(node);
                        node.selected = true;
                    }
                    
                    // Update primary selected node
                    this.app.selectedNode = node;
                    this.app.nodeManager.updatePropertiesPanel(node);
                    
                    console.log('Multi-select toggled:', node.title, 'Total selected:', this.app.selectedNodes.size);
                }
                // Force canvas redraw
                this.app.canvas.setDirty(true, true);
                return true;
            } else {
                // Single selection mode
                if (node) {
                    // Clear previous multi-selection if not holding Ctrl
                    this.clearMultiSelection();
                    
                    // Select single node
                    this.app.selectedNodes.add(node);
                    node.selected = true;
                    this.app.selectedNode = node;
                    this.app.nodeManager.updatePropertiesPanel(node);
                    
                    console.log('Single select:', node.title);
                    
                    // Force canvas redraw
                    this.app.canvas.setDirty(true, true);
                    return false;
                } else {
                    // Clicked on empty space - clear all selections
                    this.clearMultiSelection();
                    this.app.selectedNode = null;
                    this.app.nodeManager.updatePropertiesPanel(null);
                    
                    // Force canvas redraw
                    this.app.canvas.setDirty(true, true);
                    return false;
                }
            }
        };
        
        // Handle mouse up for selection box
        this.app.canvas.onMouseUp = (e, localPos) => {
            this.app.canvas.setDirty(true, true);
        };

        this.setupAdvancedMouseEvents();
    }

    setupAdvancedMouseEvents() {
        // Store last mouse position for multi-drag calculation
        const originalProcessMouseDown = this.app.canvas.processMouseDown;
        this.app.canvas.processMouseDown = (e) => {
            const mouse = this.app.canvas.graph_mouse;
            this.app.canvas.last_mouse_position = [mouse[0], mouse[1]];
            
            // Handle box selection start
            if ((e.ctrlKey || e.metaKey) && !this.app.graph.getNodeOnPos(mouse[0], mouse[1])) {
                this.app.canvas.box_selection_start = [mouse[0], mouse[1]];
                this.app.canvas.is_box_selecting = true;
                console.log('Started box selection at:', mouse);
                return true;
            }
            
            return originalProcessMouseDown.call(this.app.canvas, e);
        };
        
        // Handle box selection dragging and completion
        const originalProcessMouseUp = this.app.canvas.processMouseUp;
        this.app.canvas.processMouseUp = (e) => {
            if (this.app.canvas.is_box_selecting && this.app.canvas.box_selection_start) {
                const mouse = this.app.canvas.graph_mouse;
                const startPos = this.app.canvas.box_selection_start;
                
                const dragDistance = Math.sqrt(
                    Math.pow(mouse[0] - startPos[0], 2) + 
                    Math.pow(mouse[1] - startPos[1], 2)
                );
                
                if (dragDistance > 10) {
                    if (!(e.ctrlKey || e.metaKey)) {
                        this.clearMultiSelection();
                    }
                    this.selectNodesInBox(startPos, mouse);
                }
                
                // Clean up box selection state
                this.app.canvas.is_box_selecting = false;
                this.app.canvas.box_selection_start = null;
                this.app.canvas.box_selection_end = null;
                
                console.log('Completed box selection');
                return true;
            }
            
            return originalProcessMouseUp.call(this.app.canvas, e);
        };
        
        this.setupMouseMoveEvents();
        this.setupRenderOverride();
    }

    setupMouseMoveEvents() {
        const originalProcessMouseMoveForBox = this.app.canvas.processMouseMove;
        this.app.canvas.processMouseMove = (e) => {
            // Handle box selection visual feedback
            if (this.app.canvas.is_box_selecting && this.app.canvas.box_selection_start) {
                const mouse = this.app.canvas.graph_mouse;
                this.app.canvas.box_selection_end = [mouse[0], mouse[1]];
                this.app.canvas.setDirty(true, true);
                return true;
            }
            
            // Handle multi-node dragging
            if (this.app.canvas.dragging_canvas || !this.app.canvas.node_dragged) {
                return originalProcessMouseMoveForBox.call(this.app.canvas, e);
            }
            
            // If multiple nodes are selected and we're dragging one of them
            if (this.app.selectedNodes.size > 1 && this.app.selectedNodes.has(this.app.canvas.node_dragged)) {
                const draggedNode = this.app.canvas.node_dragged;
                const mouse = this.app.canvas.graph_mouse;
                const lastMouse = this.app.canvas.last_mouse_position;
                
                if (lastMouse) {
                    const deltaX = mouse[0] - lastMouse[0];
                    const deltaY = mouse[1] - lastMouse[1];
                    
                    // Move all selected nodes by the same delta
                    this.app.selectedNodes.forEach(node => {
                        if (node !== draggedNode) {
                            node.pos[0] += deltaX;
                            node.pos[1] += deltaY;
                        }
                    });
                    
                    console.log(`Multi-drag: Moving ${this.app.selectedNodes.size} nodes by (${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})`);
                }
            }
            
            return originalProcessMouseMoveForBox.call(this.app.canvas, e);
        };
    }

    setupRenderOverride() {
        // Override render method to draw selection box
        const originalRender = this.app.canvas.render;
        this.app.canvas.render = function() {
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
    }

    resizeCanvas() {
        const container = document.querySelector('.canvas-container');
        const canvas = document.getElementById("graphCanvas");
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        this.app.canvas.resize();
    }

    // Multi-selection helper methods
    clearMultiSelection() {
        this.app.selectedNodes.forEach(node => {
            node.selected = false;
        });
        this.app.selectedNodes.clear();
        console.log('Cleared multi-selection');
    }
    
    selectNodesInBox(startPos, endPos) {
        const minX = Math.min(startPos[0], endPos[0]);
        const maxX = Math.max(startPos[0], endPos[0]);
        const minY = Math.min(startPos[1], endPos[1]);
        const maxY = Math.max(startPos[1], endPos[1]);
        
        let selectedCount = 0;
        
        this.app.graph._nodes.forEach(node => {
            const nodeX = node.pos[0];
            const nodeY = node.pos[1];
            const nodeWidth = node.size[0] || 150;
            const nodeHeight = node.size[1] || 80;
            
            // Check if node intersects with selection box
            if (nodeX < maxX && nodeX + nodeWidth > minX &&
                nodeY < maxY && nodeY + nodeHeight > minY) {
                
                this.app.selectedNodes.add(node);
                node.selected = true;
                selectedCount++;
            }
        });
        
        console.log(`Box selection: Selected ${selectedCount} nodes in box`);
        
        // Update properties panel with the last selected node
        if (selectedCount > 0) {
            const lastSelected = Array.from(this.app.selectedNodes).pop();
            this.app.selectedNode = lastSelected;
            this.app.nodeManager.updatePropertiesPanel(lastSelected);
        }
        
        this.app.canvas.setDirty(true, true);
    }
    
    selectAllNodes() {
        this.clearMultiSelection();
        
        this.app.graph._nodes.forEach(node => {
            this.app.selectedNodes.add(node);
            node.selected = true;
        });
        
        console.log(`Selected all ${this.app.selectedNodes.size} nodes`);
        
        // Update properties panel with the last node
        if (this.app.selectedNodes.size > 0) {
            const lastSelected = Array.from(this.app.selectedNodes).pop();
            this.app.selectedNode = lastSelected;
            this.app.nodeManager.updatePropertiesPanel(lastSelected);
        }
        
        this.app.canvas.setDirty(true, true);
    }
    
    deleteSelectedNodes() {
        if (this.app.selectedNodes.size === 0) return;
        
        const nodeCount = this.app.selectedNodes.size;
        
        // Remove nodes from graph
        this.app.selectedNodes.forEach(node => {
            this.app.graph.remove(node);
        });
        
        console.log(`Deleted ${nodeCount} selected nodes`);
        
        // Clear selection
        this.clearMultiSelection();
        this.app.selectedNode = null;
        this.app.nodeManager.updatePropertiesPanel(null);
        
        this.app.canvas.setDirty(true, true);
    }
}