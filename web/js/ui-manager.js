// UI交互管理模块 - 负责模态框、拖拽、事件监听等UI交互
class UIManager {
    constructor(app) {
        this.app = app;
    }

    initializeEventListeners() {
        // Project controls
        document.getElementById('createProjectBtn').addEventListener('click', () => this.app.projectManager.showCreateProjectModal());
        document.getElementById('loadProject').addEventListener('click', () => this.app.projectManager.loadProject());
        document.getElementById('saveProject').addEventListener('click', () => this.app.projectManager.saveProject());

        // Execution controls
        document.getElementById('playCurrentBtn').addEventListener('click', () => this.app.executionManager.startCurrentExecution());
        document.getElementById('playAllBtn').addEventListener('click', () => this.app.executionManager.startAllExecution());
        document.getElementById('stopBtn').addEventListener('click', () => this.app.executionManager.stopExecution());
        
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
        }, 500);

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
            this.handleKeyboardShortcuts(e);
        });
    }

    handleKeyboardShortcuts(e) {
        // Ctrl+A to select all nodes
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.app.canvasManager.selectAllNodes();
        }
        
        // Delete key to delete selected nodes
        if (e.key === 'Delete' && this.app.selectedNodes.size > 0) {
            e.preventDefault();
            this.app.canvasManager.deleteSelectedNodes();
        }
        
        // Escape key to clear selection
        if (e.key === 'Escape') {
            this.app.canvasManager.clearMultiSelection();
            this.app.selectedNode = null;
            this.app.nodeManager.updatePropertiesPanel(null);
        }
    }

    initializeNodePanelDragDrop() {
        console.log('Initializing node panel drag and drop...');
        
        const nodeItems = document.querySelectorAll('.node-item');
        console.log(`Found ${nodeItems.length} node items`);
        
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
                this.app.nodeManager.addNodeToGraph(item.dataset.type, [400, 300]);
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
                    const canvasPos = this.app.canvas.convertEventToCanvasOffset(e);
                    console.log(`Canvas position: ${canvasPos[0]}, ${canvasPos[1]}`);
                    this.app.nodeManager.addNodeToGraph(nodeType, [canvasPos[0], canvasPos[1]]);
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

    // Upload Modal Management
    showUploadModal(node) {
        if (node) {
            this.app.currentUploadNode = node;
            this.app.selectedImagePath = null;
            
            // Reset tabs to show existing images first
            this.switchTab('existing');
            this.loadExistingImages();
            
            document.getElementById('uploadModal').style.display = 'flex';
        }
    }

    hideUploadModal() {
        document.getElementById('uploadModal').style.display = 'none';
        this.app.currentUploadNode = null;
        this.app.selectedImagePath = null;
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

    // Image Management
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
                    <div class="image-item-content" onclick="app.uiManager.selectExistingImage('${image.path}', this.parentElement)">
                        <img class="image-preview" src="/api/images/${image.filename}" alt="${image.filename}" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjQwIiB5PSI0NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSI+Pz88L3RleHQ+Cjwvc3ZnPg=='" />
                        <div class="image-name">${displayName}</div>
                        <div class="image-size">${sizeKB} KB</div>
                    </div>
                    <button class="delete-image-btn" onclick="app.uiManager.confirmDeleteImage('${image.filename}', event)" title="删除图片">
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
            <button class="select-button" onclick="app.uiManager.useSelectedImage()" disabled id="selectBtn">
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
        this.app.selectedImagePath = imagePath;

        // Enable select button
        document.getElementById('selectBtn').disabled = false;
    }

    useSelectedImage() {
        if (!this.app.selectedImagePath || !this.app.currentUploadNode) return;

        // Store the selected path before modal is closed
        const selectedPath = this.app.selectedImagePath;

        // Update node property
        this.app.currentUploadNode.properties.image_path = selectedPath;
        
        // Clear missing image flag if it was set
        if (this.app.currentUploadNode.flags && this.app.currentUploadNode.flags.missingImage) {
            this.app.currentUploadNode.flags.missingImage = false;
        }
        
        // Refresh properties panel
        this.app.nodeManager.updatePropertiesPanel(this.app.currentUploadNode);
        
        // Force node redraw to show updated image info
        this.app.currentUploadNode.setDirtyCanvas(true, true);
        this.app.canvas.setDirty(true, true);
        
        // Close modal
        this.hideUploadModal();
        
        const filename = this.app.getFilenameFromPath(selectedPath);
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
                this.app.nodeManager.markNodesWithMissingImage(filename);
                
                // Refresh the images list
                this.loadExistingImages();
                
                // Reset selection if the deleted image was selected
                if (this.app.selectedImagePath && this.app.selectedImagePath.includes(filename)) {
                    this.app.selectedImagePath = null;
                    document.getElementById('selectBtn').disabled = true;
                }
                
                // Mark all canvas as dirty to refresh node displays
                this.app.canvas.setDirty(true, true);
                
            } else {
                const error = await response.json();
                alert(`删除失败: ${error.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('Delete image error:', error);
            alert('删除图片时发生错误');
        }
    }

    async uploadFile(file) {
        if (!this.app.currentUploadNode) return;

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
                this.app.currentUploadNode.properties.image_path = result.path;
                
                // Clear missing image flag if it was set
                if (this.app.currentUploadNode.flags && this.app.currentUploadNode.flags.missingImage) {
                    this.app.currentUploadNode.flags.missingImage = false;
                }
                
                // Refresh properties panel
                this.app.nodeManager.updatePropertiesPanel(this.app.currentUploadNode);
                
                // Force node redraw to show updated image info
                this.app.currentUploadNode.setDirtyCanvas(true, true);
                this.app.canvas.setDirty(true, true);
                
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
}