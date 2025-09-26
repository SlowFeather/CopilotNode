// Drawing Manager for Multi-Drawing Support
class DrawingManager {
    constructor() {
        this.drawings = new Map();
        this.currentDrawingId = null;
        this.statusUpdateInterval = null;
        this.autoSaveInterval = null;
        this.initializeUI();
        this.checkAndLoadDrawings(); // Changed to conditional loading
        this.startStatusPolling();
        this.setupAutoSave();
        
        // Initialize with no drawing selected state
        this.updateCurrentDrawingIndicator(null);
        
        // Initialize properties panel state
        setTimeout(() => {
            if (window.app && typeof window.app.nodeManager.updatePropertiesPanel === 'function') {
                window.app.nodeManager.updatePropertiesPanel(null);
            }
        }, 100);
    }

    initializeUI() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupUIElements();
            });
        } else {
            this.setupUIElements();
        }
    }

    setupUIElements() {
        // Create drawing button
        const createBtn = document.getElementById('createDrawingBtn');
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Create drawing button clicked');
                this.showCreateDrawingModal();
            });
            console.log('Create drawing button event listener added');
        } else {
            console.warn('Create drawing button not found');
        }

        // Sidebar toggle functionality
        this.initializeSidebarToggle();

        this.setupModalEventListeners();
        this.setupBoundaryControls();
    }

    setupModalEventListeners() {
        // Create drawing modal
        const createModal = document.getElementById('createDrawingModal');
        const closeCreateModal = document.getElementById('closeCreateDrawingModal');
        const cancelCreateDrawing = document.getElementById('cancelCreateDrawing');
        const confirmCreateDrawing = document.getElementById('confirmCreateDrawing');

        if (closeCreateModal) {
            closeCreateModal.addEventListener('click', () => this.hideCreateDrawingModal());
        }
        if (cancelCreateDrawing) {
            cancelCreateDrawing.addEventListener('click', () => this.hideCreateDrawingModal());
        }
        if (confirmCreateDrawing) {
            confirmCreateDrawing.addEventListener('click', () => this.createDrawing());
        }

        // Close modal when clicking outside
        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) {
                    this.hideCreateDrawingModal();
                }
            });
        }
    }

    setupBoundaryControls() {
        // Boundary controls
        const setBoundaryBtn = document.getElementById('setBoundaryBtn');
        const previewBoundaryBtn = document.getElementById('previewBoundaryBtn');

        if (setBoundaryBtn) {
            setBoundaryBtn.addEventListener('click', () => this.setBoundary());
        }
        if (previewBoundaryBtn) {
            previewBoundaryBtn.addEventListener('click', () => this.previewBoundary());
        }
    }

    initializeSidebarToggle() {
        // Add collapse button to drawing panel header
        const header = document.querySelector('.drawing-panel-header');
        if (!header) return;

        // Check if toggle button already exists
        if (header.querySelector('.panel-toggle-btn')) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'panel-toggle-btn';
        toggleBtn.innerHTML = '◀';
        toggleBtn.title = '折叠/展开画图管理器';
        
        // Insert before the create button
        const createBtn = document.getElementById('createDrawingBtn');
        if (createBtn) {
            header.insertBefore(toggleBtn, createBtn);
        } else {
            header.appendChild(toggleBtn);
        }

        // Toggle functionality
        const drawingPanel = document.querySelector('.drawing-panel');
        let isCollapsed = localStorage.getItem('drawingPanelCollapsed') === 'true';

        // Apply initial state
        if (isCollapsed) {
            this.collapseSidebar(drawingPanel, toggleBtn);
        }

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isCollapsed) {
                this.expandSidebar(drawingPanel, toggleBtn);
            } else {
                this.collapseSidebar(drawingPanel, toggleBtn);
            }
            
            isCollapsed = !isCollapsed;
            localStorage.setItem('drawingPanelCollapsed', isCollapsed);
        });
    }

    collapseSidebar(panel, toggleBtn) {
        if (!panel) return;
        
        panel.classList.add('collapsed');
        toggleBtn.innerHTML = '▶';
        toggleBtn.title = '展开画图管理器';
        
        // Store original width
        if (!panel.dataset.originalWidth) {
            panel.dataset.originalWidth = getComputedStyle(panel).width;
        }
    }

    expandSidebar(panel, toggleBtn) {
        if (!panel) return;
        
        panel.classList.remove('collapsed');
        toggleBtn.innerHTML = '◀';
        toggleBtn.title = '折叠画图管理器';
    }

    async checkAndLoadDrawings() {
        try {
            console.log('🔍 Checking for active project...');
            // First check if there's an active project
            const activeProjectResponse = await fetch(`/api/projects/active?_t=${Date.now()}`, {
                cache: 'no-cache'
            });
            console.log('📡 Active project response status:', activeProjectResponse.status);
            
            if (activeProjectResponse.status === 404) {
                // No active project - show empty state
                console.log('📭 No active project found - rendering empty state');
                this.renderEmptyState();
                return;
            }
            
            if (activeProjectResponse.ok) {
                // There's an active project - load its drawings
                console.log('✅ Active project found - loading drawings');
                await this.loadDrawings();
            } else {
                console.warn('⚠️ Failed to check active project status, status:', activeProjectResponse.status);
                this.renderEmptyState();
            }
        } catch (error) {
            console.error('❌ Failed to check active project:', error);
            console.log('🔄 Rendering empty state due to error');
            this.renderEmptyState();
        }
    }
    
    async loadDrawings() {
        try {
            console.log('🔄 Loading drawings from API...');
            // Add cache-busting parameter to ensure fresh data
            const response = await fetch(`/api/drawings?_t=${Date.now()}`, {
                cache: 'no-cache'
            });
            const data = await response.json();

            console.log('📡 API response:', data);

            if (data.drawings) {
                console.log(`📝 Received ${data.drawings.length} drawings`);
                this.drawings.clear();
                data.drawings.forEach(drawing => {
                    console.log(`  - ${drawing.name} (ID: ${drawing.id.substring(0,8)}..., order: ${drawing.order})`);
                    this.drawings.set(drawing.id, drawing);
                });
                this.renderDrawingList();
                console.log('✅ Drawing list rendered');
            }
        } catch (error) {
            console.error('Failed to load drawings:', error);
            this.showError('加载画图列表失败');
        }
    }
    
    renderEmptyState() {
        console.log('🗂️ Rendering empty state');
        
        // Clear drawings data
        this.drawings.clear();
        this.currentDrawingId = null;
        
        // Update UI
        this.updateCurrentDrawingIndicator(null);
        
        const drawingList = document.querySelector('.drawing-list');
        if (!drawingList) {
            console.warn('⚠️ Drawing list element not found');
            return;
        }
        
        drawingList.innerHTML = `
            <div class="no-project-state">
                <div class="empty-icon">📁</div>
                <div class="empty-message">请先选择或创建项目</div>
                <div class="empty-hint">选择项目后即可管理画图</div>
            </div>
        `;
        
        console.log('✅ Empty state rendered successfully');
    }

    renderDrawingList() {
        const drawingList = document.querySelector('.drawing-list');
        if (!drawingList) return;

        if (this.drawings.size === 0) {
            drawingList.innerHTML = '<div class="loading-drawings">暂无画图，点击 + 创建新画图</div>';
            return;
        }

        // Sort drawings by order field for consistent order
        const drawingsArray = Array.from(this.drawings.values());
        //console.log('🔀 Before sorting:', drawingsArray.map(d => `${d.name}(order:${d.order})`));
        const sortedDrawings = drawingsArray.sort((a, b) => (a.order || 0) - (b.order || 0));
        //console.log('🔀 After sorting:', sortedDrawings.map(d => `${d.name}(order:${d.order})`));
        const drawingItems = sortedDrawings.map(drawing => {
            const isActive = drawing.id === this.currentDrawingId;
            const isRunning = drawing.execution_state?.is_running;
            const status = drawing.execution_state?.status || 'idle';
            const progress = drawing.execution_state?.progress || 0;

            let statusClass = '';
            let statusText = '空闲';
            
            if (isRunning) {
                statusClass = 'running';
                statusText = '运行中';
            } else if (status === 'error') {
                statusClass = 'error';
                statusText = '错误';
            } else if (status === 'completed') {
                statusText = '已完成';
            }

            return `
                <div class="drawing-item ${isActive ? 'active' : ''} ${statusClass}" data-drawing-id="${drawing.id}">
                    <div class="drawing-name">${drawing.name}</div>
                    <div class="drawing-info">
                        <div class="drawing-status">
                            <div class="status-indicator ${statusClass}"></div>
                            <span>状态: ${statusText}</span>
                        </div>
                        <div>节点: ${drawing.node_count || 0}</div>
                        <div>边界: ${drawing.boundary?.width || 1920}x${drawing.boundary?.height || 1080}</div>
                        ${drawing.last_executed ? `<div>最后执行: ${new Date(drawing.last_executed).toLocaleString()}</div>` : ''}
                        ${isRunning ? `
                            <div class="drawing-progress">
                                <div>进度: ${progress}%</div>
                                <div class="drawing-progress-bar">
                                    <div class="drawing-progress-fill" style="width: ${progress}%"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="drawing-actions">
                        ${!isRunning ?
                            `<button class="drawing-action-btn play" data-action="play" data-drawing-id="${drawing.id}" title="运行">▶</button>` :
                            `<button class="drawing-action-btn stop" data-action="stop" data-drawing-id="${drawing.id}" title="停止">⏹</button>`
                        }
                        <button class="drawing-action-btn move-up" data-action="move-up" data-drawing-id="${drawing.id}" title="上移">↑</button>
                        <button class="drawing-action-btn move-down" data-action="move-down" data-drawing-id="${drawing.id}" title="下移">↓</button>
                        <button class="drawing-action-btn copy" data-action="copy" data-drawing-id="${drawing.id}" title="复制">📋</button>
                        <button class="drawing-action-btn delete" data-action="delete" data-drawing-id="${drawing.id}" title="删除">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        drawingList.innerHTML = drawingItems;

        // Add event listeners
        drawingList.querySelectorAll('.drawing-item').forEach(item => {
            const drawingId = item.dataset.drawingId;
            
            // Click to select drawing
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('drawing-action-btn')) {
                    this.selectDrawing(drawingId);
                }
            });
        });
        // Action buttons
        drawingList.querySelectorAll('.drawing-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const drawingId = btn.dataset.drawingId;
                
                if (action === 'play') {
                    this.executeDrawing(drawingId);
                } else if (action === 'stop') {
                    this.stopDrawing(drawingId);
                } else if (action === 'move-up') {
                    this.moveDrawingUp(drawingId);
                } else if (action === 'move-down') {
                    this.moveDrawingDown(drawingId);
                } else if (action === 'copy') {
                    this.copyDrawing(drawingId);
                } else if (action === 'delete') {
                    this.deleteDrawing(drawingId);
                }
            });
        });
    }

    async selectDrawing(drawingId) {
        if (this.currentDrawingId === drawingId) return;

        try {
            // Save current drawing before switching if there was one
            if (this.currentDrawingId && window.app && window.app.graph._nodes.length > 0) {
                console.log(`Auto-saving current drawing ${this.currentDrawingId} before switching...`);
                await this.saveCurrentDrawing();
            }

            // Load drawing data
            const response = await fetch(`/api/drawings/${drawingId}?_t=${Date.now()}`, {
                cache: 'no-cache'
            });
            const drawing = await response.json();

            if (drawing.error) {
                this.showError(drawing.error);
                return;
            }

            this.currentDrawingId = drawingId;
            
            // Update drawing in local map
            this.drawings.set(drawingId, drawing);
            
            // Update current drawing indicator
            this.updateCurrentDrawingIndicator(drawing.name);
            
            // Load nodes into graph
            if (window.app) {
                
                // Clear current graph
                window.app.graph.clear();
                
                // Load new drawing's nodes if any exist
                if (drawing.nodes && drawing.nodes.length > 0) {
                    console.log(`Loading ${drawing.nodes.length} nodes for drawing ${drawing.name}`);
                    
                    // Sort nodes by ID to ensure consistent loading order and avoid ID conflicts
                    const sortedNodes = [...drawing.nodes].sort((a, b) => parseInt(a.id) - parseInt(b.id));
                    console.log(`📊 Loading nodes in ID order: ${sortedNodes.map(n => n.id).join(', ')}`);
                    
                    // Set the graph's node counter to the highest ID + 1 to prevent conflicts
                    const maxId = Math.max(...sortedNodes.map(n => parseInt(n.id)));
                    window.app.graph._last_node_id = maxId + 1;
                    console.log(`🔧 Set graph node counter to: ${window.app.graph._last_node_id}`);
                    
                    sortedNodes.forEach(nodeData => {
                        const loadedNode = window.app.nodeManager.loadNodeFromData(nodeData);
                        if (!loadedNode) {
                            console.warn('Failed to load node:', nodeData);
                        }
                    });
                    
                    // Process connections after all nodes are loaded
                    this.processNodeConnections();
                    
                    // Force complete canvas and graph refresh to fix connection rendering issues
                    const self = this; // Capture this reference for setTimeout callback
                    setTimeout(() => {
                        if (window.app.canvas && window.app.graph) {
                            console.log('🔄 Performing complete graph and canvas refresh...');
                            
                            // Force graph to recalculate all internal structures
                            window.app.graph._version++;
                            window.app.graph.updateExecutionOrder();
                            
                            // Force canvas refresh with complete redraw
                            window.app.canvas.setDirty(true, true);
                            window.app.canvas.draw(true, true);
                            window.app.canvas.setDirty(true, true);
                            
                            // Update node count in drawing data and refresh UI
                            const actualNodeCount = window.app.graph._nodes ? window.app.graph._nodes.length : 0;
                            drawing.node_count = actualNodeCount;
                            self.drawings.set(drawingId, drawing);
                            self.renderDrawingList();
                            console.log(`✅ Updated node count to ${actualNodeCount} for drawing ${drawing.name}`);
                        }
                    }, 100);
                } else {
                    console.log(`No nodes to load for drawing ${drawing.name} - ready for new nodes`);
                    // Update node count for empty drawing
                    drawing.node_count = 0;
                    this.drawings.set(drawingId, drawing);
                    this.renderDrawingList();
                    console.log(`✅ Updated node count to 0 for empty drawing ${drawing.name}`);
                }
                
                // Clear any node selection after loading
                if (window.app.canvas) {
                    window.app.canvas.deselectAllNodes();
                    window.app.selectedNode = null;
                    window.app.selectedNodes.clear();
                    window.app.nodeManager.updatePropertiesPanel(null);
                    console.log('Cleared node selection after drawing switch');
                }
                
                // Enable auto-save for this drawing
                this.setupAutoSaveForCurrentDrawing();
            }

            // Update boundary controls
            this.updateBoundaryControls(drawing.boundary);
            
            // Show boundary section in properties panel
            const drawingBoundarySection = document.getElementById('drawingBoundarySection');
            if (drawingBoundarySection) {
                drawingBoundarySection.style.display = 'block';
            }

            // Update properties panel to show drawing selected state
            if (window.app && typeof window.app.nodeManager.updatePropertiesPanel === 'function') {
                window.app.nodeManager.updatePropertiesPanel(null); // Pass null to show drawing state
            }

            this.renderDrawingList();
        } catch (error) {
            console.error('Failed to select drawing:', error);
            this.showError('加载画图失败');
        }
    }

    updateBoundaryControls(boundary) {
        if (!boundary) return;

        const xInput = document.getElementById('boundaryX');
        const yInput = document.getElementById('boundaryY');
        const widthInput = document.getElementById('boundaryWidth');
        const heightInput = document.getElementById('boundaryHeight');

        if (xInput) xInput.value = boundary.x || 0;
        if (yInput) yInput.value = boundary.y || 0;
        if (widthInput) widthInput.value = boundary.width || 1920;
        if (heightInput) heightInput.value = boundary.height || 1080;
    }

    async executeDrawing(drawingId) {
        try {
            const response = await fetch(`/api/drawings/${drawingId}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    loop: document.getElementById('loopCheck')?.checked || false,
                    speed: parseFloat(document.getElementById('speedSlider')?.value || 1.0)
                })
            });

            const result = await response.json();
            
            if (result.error) {
                this.showError(result.error);
            } else {
                console.log('Drawing execution started:', result.message);
            }
        } catch (error) {
            console.error('Failed to execute drawing:', error);
            this.showError('启动画图执行失败');
        }
    }

    async stopDrawing(drawingId) {
        try {
            const response = await fetch(`/api/drawings/${drawingId}/execute`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.error) {
                this.showError(result.error);
            } else {
                console.log('Drawing execution stopped:', result.message);
            }
        } catch (error) {
            console.error('Failed to stop drawing:', error);
            this.showError('停止画图执行失败');
        }
    }

    async deleteDrawing(drawingId) {
        if (!confirm('确定要删除这个画图吗？')) {
            return;
        }

        try {
            const response = await fetch(`/api/drawings/${drawingId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.error) {
                this.showError(result.error);
            } else {
                // Reload drawings to get updated state from server
                await this.loadDrawings();
                if (this.currentDrawingId === drawingId) {
                    this.clearCurrentDrawing();
                }
                this.showSuccess('画图已删除');
            }
        } catch (error) {
            console.error('Failed to delete drawing:', error);
            this.showError('删除画图失败');
        }
    }

    async moveDrawingUp(drawingId) {
        try {
            const response = await fetch(`/api/drawings/${drawingId}/move-up`, {
                method: 'POST'
            });

            if (response.ok) {
                // Reload drawings to get updated order
                await this.loadDrawings();
                this.showSuccess('画图已上移');
            } else {
                const error = await response.json();
                // Still reload drawings to sync current state even on error
                await this.loadDrawings();
                this.showError(error.error || '上移画图失败');
            }
        } catch (error) {
            console.error('Failed to move drawing up:', error);
            // Reload drawings to ensure UI is in sync
            await this.loadDrawings();
            this.showError('上移画图失败');
        }
    }

    async moveDrawingDown(drawingId) {
        try {
            const response = await fetch(`/api/drawings/${drawingId}/move-down`, {
                method: 'POST'
            });

            if (response.ok) {
                // Reload drawings to get updated order
                await this.loadDrawings();
                this.showSuccess('画图已下移');
            } else {
                const error = await response.json();
                // Still reload drawings to sync current state even on error
                await this.loadDrawings();
                this.showError(error.error || '下移画图失败');
            }
        } catch (error) {
            console.error('Failed to move drawing down:', error);
            // Reload drawings to ensure UI is in sync
            await this.loadDrawings();
            this.showError('下移画图失败');
        }
    }

    async copyDrawing(drawingId) {
        try {
            const originalDrawing = this.drawings.get(drawingId);
            const newName = prompt('请输入新画图的名称:', `${originalDrawing?.name || '画图'} - 副本`);

            if (!newName || newName.trim() === '') {
                return; // User cancelled or entered empty name
            }

            const response = await fetch(`/api/drawings/${drawingId}/copy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName.trim() })
            });

            if (response.ok) {
                const result = await response.json();
                // Reload drawings to show the new copy
                await this.loadDrawings();
                this.showSuccess(`画图已复制: ${newName}`);

                // Optionally select the new drawing
                if (result.new_drawing_id) {
                    await this.selectDrawing(result.new_drawing_id);
                }
            } else {
                const error = await response.json();
                this.showError(error.error || '复制画图失败');
            }
        } catch (error) {
            console.error('Failed to copy drawing:', error);
            this.showError('复制画图失败');
        }
    }

    showCreateDrawingModal() {
        console.log('showCreateDrawingModal called');
        const modal = document.getElementById('createDrawingModal');
        console.log('Modal element:', modal);
        
        if (modal) {
            modal.style.display = 'flex';
            console.log('Modal display set to flex');
            
            // Reset form
            const nameInput = document.getElementById('newDrawingName');
            const xInput = document.getElementById('newDrawingX');
            const yInput = document.getElementById('newDrawingY');
            const widthInput = document.getElementById('newDrawingWidth');
            const heightInput = document.getElementById('newDrawingHeight');

            if (nameInput) nameInput.value = '';
            if (xInput) xInput.value = '0';
            if (yInput) yInput.value = '0';
            // Use current screen resolution as default values
            if (widthInput) widthInput.value = screen.width.toString();
            if (heightInput) heightInput.value = screen.height.toString();
            
            console.log('Form reset completed');
        } else {
            console.error('Create drawing modal not found in DOM');
        }
    }

    hideCreateDrawingModal() {
        const modal = document.getElementById('createDrawingModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async createDrawing() {
        const name = document.getElementById('newDrawingName').value.trim();
        if (!name) {
            this.showError('请输入画图名称');
            return;
        }

        const boundary = {
            x: parseInt(document.getElementById('newDrawingX').value) || 0,
            y: parseInt(document.getElementById('newDrawingY').value) || 0,
            width: parseInt(document.getElementById('newDrawingWidth').value) || 1920,
            height: parseInt(document.getElementById('newDrawingHeight').value) || 1080
        };

        try {
            const response = await fetch(`/api/drawings?_t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    nodes: [],
                    boundary: boundary
                })
            });

            const result = await response.json();
            
            if (result.error) {
                this.showError(result.error);
            } else {
                this.hideCreateDrawingModal();
                await this.loadDrawings();
                // Auto-select the new drawing
                if (result.drawing_id) {
                    await this.selectDrawing(result.drawing_id);
                }
            }
        } catch (error) {
            console.error('Failed to create drawing:', error);
            this.showError('创建画图失败');
        }
    }

    async setBoundary() {
        if (!this.currentDrawingId) {
            this.showError('请先选择一个画图');
            return;
        }

        const boundary = {
            x: parseInt(document.getElementById('boundaryX').value) || 0,
            y: parseInt(document.getElementById('boundaryY').value) || 0,
            width: parseInt(document.getElementById('boundaryWidth').value) || 1920,
            height: parseInt(document.getElementById('boundaryHeight').value) || 1080
        };

        try {
            const response = await fetch(`/api/drawings/${this.currentDrawingId}/boundary?_t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ boundary })
            });

            const result = await response.json();
            
            if (result.error) {
                this.showError(result.error);
            } else {
                // Update local drawing data
                const drawing = this.drawings.get(this.currentDrawingId);
                if (drawing) {
                    drawing.boundary = boundary;
                    this.drawings.set(this.currentDrawingId, drawing);
                }
                this.renderDrawingList();
                console.log('Boundary set successfully');
            }
        } catch (error) {
            console.error('Failed to set boundary:', error);
            this.showError('设置边界失败');
        }
    }

    previewBoundary() {
        const x = parseInt(document.getElementById('boundaryX').value) || 0;
        const y = parseInt(document.getElementById('boundaryY').value) || 0;
        const width = parseInt(document.getElementById('boundaryWidth').value) || 1920;
        const height = parseInt(document.getElementById('boundaryHeight').value) || 1080;

        const preview = document.getElementById('boundaryPreview');
        if (!preview) return;

        preview.style.left = x + 'px';
        preview.style.top = y + 'px';
        preview.style.width = width + 'px';
        preview.style.height = height + 'px';
        preview.style.display = 'block';

        // Hide after 3 seconds
        setTimeout(() => {
            preview.style.display = 'none';
        }, 3000);
    }

    async saveCurrentDrawing() {
        if (!this.currentDrawingId || !window.app) {
            return;
        }

        try {
            // Get current nodes from graph
            const nodes = [];
            if (window.app.graph._nodes) {
                console.log(`💾 Saving ${window.app.graph._nodes.length} nodes from graph:`);
                window.app.graph._nodes.forEach(node => {
                    console.log(`  📝 Processing node ${node.id} (${node.title})`);
                    nodes.push(window.app.nodeManager.serializeNodeToData(node));
                });
                console.log(`💾 Total serialized nodes: ${nodes.length}`);
            }

            const response = await fetch(`/api/drawings/${this.currentDrawingId}?_t=${Date.now()}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nodes })
            });

            const result = await response.json();
            
            if (result.error) {
                console.error('Failed to save drawing:', result.error);
            } else {
                console.log(`Saved ${nodes.length} nodes for drawing ${this.currentDrawingId}`);
            }
        } catch (error) {
            console.error('Failed to save drawing:', error);
        }
    }

    processNodeConnections() {
        // Process pending connections after all nodes are loaded
        if (!window.app || !window.app.graph || !window.app.graph._nodes) return;
        
        const nodesToConnect = [];
        const allNodeIds = [];
        
        window.app.graph._nodes.forEach(node => {
            allNodeIds.push(`${node.id}`);
            if (node._pendingConnections && node._pendingConnections.length > 0) {
                nodesToConnect.push(node);
            }
        });
        
        console.log(`Processing connections for ${nodesToConnect.length} nodes out of ${window.app.graph._nodes.length} total nodes`);
        console.log(`Available nodes: ${allNodeIds.join(', ')}`);

        let successfulConnections = 0;
        let failedConnections = 0;

        nodesToConnect.forEach(node => {
            console.log(`Node ${node.id} has pending connections:`, node._pendingConnections);

            node._pendingConnections.forEach(targetNodeId => {
                // Direct ID lookup - now possible with unified ID management
                const targetNode = window.app.graph.getNodeById(parseInt(targetNodeId));

                if (targetNode && node.outputs && node.outputs[0] && targetNode.inputs && targetNode.inputs[0]) {
                    console.log(`✅ Connecting node ${node.id} to node ${targetNode.id}`);
                    node.connect(0, targetNode, 0);
                    successfulConnections++;
                } else {
                    console.warn(`❌ Failed to connect node ${node.id} to ${targetNodeId}`);
                    if (!targetNode) {
                        console.warn(`  - Target node ${targetNodeId} not found`);
                    } else if (!node.outputs || !node.outputs[0]) {
                        console.warn(`  - Source node has no outputs`);
                    } else if (!targetNode.inputs || !targetNode.inputs[0]) {
                        console.warn(`  - Target node has no inputs`);
                    }
                    failedConnections++;
                }
            });
            delete node._pendingConnections;
        });
        
        console.log(`Connection processing complete: ${successfulConnections} successful, ${failedConnections} failed`);
        
        // Validate connections after processing
        console.log('🔍 Validating connections after processing:');
        window.app.graph._nodes.forEach(node => {
            if (node.outputs && node.outputs[0] && node.outputs[0].links) {
                node.outputs[0].links.forEach(linkId => {
                    const link = window.app.graph.links[linkId];
                    if (link) {
                        const targetNode = window.app.graph.getNodeById(link.target_id);
                        console.log(`  ${node.id} -> ${link.target_id} ${targetNode ? '✅' : '❌'}`);
                    }
                });
            }
        });
    }

    setupAutoSaveForCurrentDrawing() {
        if (!window.app || !this.currentDrawingId) return;

        // Clear any existing auto-save timers
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Set up auto-save when nodes are added/removed/modified
        const originalOnNodeAdded = window.app.graph.onNodeAdded;
        const originalOnNodeRemoved = window.app.graph.onNodeRemoved;

        window.app.graph.onNodeAdded = (node) => {
            if (originalOnNodeAdded) originalOnNodeAdded.call(window.app.graph, node);
            this.scheduleAutoSave();
        };

        window.app.graph.onNodeRemoved = (node) => {
            if (originalOnNodeRemoved) originalOnNodeRemoved.call(window.app.graph, node);
            this.scheduleAutoSave();
        };

        console.log(`Auto-save enabled for drawing ${this.currentDrawingId}`);
    }

    scheduleAutoSave() {
        if (!this.currentDrawingId) return;
        
        // Debounce auto-save to avoid too frequent saves
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveCurrentDrawing();
        }, 2000); // Save 2 seconds after last change
    }

    updateCurrentDrawingIndicator(drawingName) {
        const indicator = document.getElementById('currentDrawingIndicator');
        const nameElement = document.getElementById('currentDrawingName');
        const noDrawingTips = document.getElementById('noDrawingTips');
        const drawingSelectedTips = document.getElementById('drawingSelectedTips');
        
        if (indicator && nameElement) {
            if (drawingName) {
                nameElement.textContent = drawingName;
                indicator.style.display = 'block';
                
                // Show drawing selected tips, hide warning
                if (noDrawingTips) noDrawingTips.style.display = 'none';
                if (drawingSelectedTips) drawingSelectedTips.style.display = 'block';
                
                console.log(`Current drawing indicator updated: ${drawingName}`);
            } else {
                indicator.style.display = 'none';
                nameElement.textContent = '无';
                
                // Show warning tips, hide drawing selected tips
                if (noDrawingTips) noDrawingTips.style.display = 'block';
                if (drawingSelectedTips) drawingSelectedTips.style.display = 'none';
            }
        }
    }

    clearCurrentDrawing() {
        this.currentDrawingId = null;
        this.updateCurrentDrawingIndicator(null);
        
        // Hide boundary section
        const drawingBoundarySection = document.getElementById('drawingBoundarySection');
        if (drawingBoundarySection) {
            drawingBoundarySection.style.display = 'none';
        }
        
        // Clear graph if app is available
        if (window.app) {
            window.app.graph.clear();
            // Update properties panel to show no drawing state
            if (typeof window.app.nodeManager.updatePropertiesPanel === 'function') {
                window.app.nodeManager.updatePropertiesPanel(null);
            }
        }
        
        this.renderDrawingList();
    }

    startStatusPolling() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }

        this.statusUpdateInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/drawings/status?_t=${Date.now()}`, {
                    cache: 'no-cache'
                });
                const data = await response.json();
                
                if (data.statuses) {
                    // Update local drawing states
                    data.statuses.forEach(status => {
                        const drawing = this.drawings.get(status.drawing_id);
                        if (drawing) {
                            drawing.execution_state = {
                                is_running: status.is_running,
                                status: status.status,
                                progress: status.progress,
                                current_node: status.current_node
                            };
                            this.drawings.set(status.drawing_id, drawing);
                        }
                    });
                    
                    this.renderDrawingList();
                }
            } catch (error) {
                console.error('Failed to update status:', error);
            }
        }, 1000);
    }

    showError(message) {
        // You can implement a proper error notification system here
        console.error(message);
        alert(message);
    }

    showSuccess(message) {
        // You can implement a proper success notification system here
        console.log(message);
        // For now, using alert - could be replaced with a toast notification
        alert(message);
    }

    setupAutoSave() {
        // Save before page unload
        window.addEventListener('beforeunload', async () => {
            if (this.currentDrawingId && window.app && window.app.graph._nodes && window.app.graph._nodes.length > 0) {
                // Save current drawing before leaving
                console.log('Page unloading - auto-saving current drawing...');
                await this.saveCurrentDrawing();
            }
        });

        // Periodic auto-save (every 30 seconds)
        this.autoSaveInterval = setInterval(async () => {
            if (this.currentDrawingId && window.app && window.app.graph._nodes && window.app.graph._nodes.length > 0) {
                console.log('Periodic auto-save...');
                await this.saveCurrentDrawing();
            }
        }, 30000); // 30 seconds

        // Save when nodes are added/removed (with debouncing)
        this._saveTimeout = null;
        this._triggerDelayedSave = () => {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = setTimeout(() => {
                if (this.currentDrawingId && window.app && window.app.graph._nodes && window.app.graph._nodes.length > 0) {
                    console.log('Change detected - auto-saving...');
                    this.saveCurrentDrawing();
                }
            }, 2000); // 2 second delay to batch changes
        };
    }

    destroy() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
    }
}

// Global drawing manager instance
window.drawingManager = null;