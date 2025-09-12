// 项目管理模块 - 负责项目的创建、加载、保存等操作
class ProjectManager {
    constructor(app) {
        this.app = app;
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
                this.app.showNotification(`项目创建成功: ${name}`, 'success');
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
                this.app.showNotification('项目加载成功', 'success');
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
            this.app.showNotification('当前画图已保存', 'success');
        } else {
            alert('没有选择的画图需要保存');
        }
    }

    // Debug function to validate project data
    validateProjectData() {
        const data = this.app.nodeManager.exportGraphData();
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