// 执行控制管理模块 - 负责画图的执行控制、状态监控和UI更新
class ExecutionManager {
    constructor(app) {
        this.app = app;
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
            if (this.app.currentExecutionType === 'current' && window.drawingManager && window.drawingManager.currentDrawingId) {
                endpoint = `/api/drawings/${window.drawingManager.currentDrawingId}/execute`;
            } else if (this.app.currentExecutionType === 'all') {
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
            
            this.app.executionStatus = {
                is_running: false,
                status: "idle",
                progress: 0,
                current_node: null,
                error: null
            };
            this.updateStatusPanel();
        }
        
        // Store execution type for status updates
        this.app.currentExecutionType = isRunning ? executionType : null;
    }

    startStatusPolling() {
        this.app.statusUpdateInterval = setInterval(() => {
            this.updateStatus();
        }, 500);
    }

    async updateStatus() {
        try {
            const response = await fetch(`/api/status?_t=${Date.now()}`, {
                cache: 'no-cache'
            });
            if (response.ok) {
                const status = await response.json();
                this.app.executionStatus = status;
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
        const status = this.app.executionStatus;
        
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
}

// Global debug functions
window.debugProject = function() {
    if (window.app) {
        return window.app.projectManager.validateProjectData();
    }
};

window.testSaveLoad = function() {
    if (window.app) {
        console.log('=== Testing save/load functionality ===');
        
        // Export current data
        const exportedData = window.app.nodeManager.exportGraphData();
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
        window.app.nodeManager.loadGraphFromData(exportedData);
        
        console.log('5. Verifying reload...');
        const reloadedData = window.app.nodeManager.exportGraphData();
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
            const originalData = window.app.nodeManager.exportGraphData();
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
            window.app.nodeManager.loadGraphFromData(loadedData);
            
            // Verify
            const finalData = window.app.nodeManager.exportGraphData();
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