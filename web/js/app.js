// 核心应用类 - 主要负责应用初始化和模块协调
class CopilotNodeApp {
    constructor() {
        this.graph = new LiteGraph.LGraph();
        this.canvas = null;
        this.selectedNode = null;
        this.selectedNodes = new Set();
        this.executionStatus = {
            is_running: false,
            status: "idle",
            progress: 0,
            current_node: null,
            error: null
        };
        this.statusUpdateInterval = null;
        this.currentUploadNode = null;
        this.selectedImagePath = null;
        this.currentExecutionType = null;

        // 初始化各个管理器
        this.canvasManager = new CanvasManager(this);
        this.nodeManager = new NodeManager(this);
        this.uiManager = new UIManager(this);
        this.projectManager = new ProjectManager(this);
        this.executionManager = new ExecutionManager(this);

        this.initialize();
    }

    async initialize() {
        // 初始化画布
        this.canvasManager.initializeCanvas();
        
        // 初始化事件监听
        this.uiManager.initializeEventListeners();
        
        // 加载项目列表
        await this.projectManager.loadProjectList();
        
        // 开始状态轮询
        this.executionManager.startStatusPolling();
        
        console.log('CopilotNodeApp initialized successfully');
    }

    // 全局方法 - 由其他模块调用
    resizeCanvas() {
        this.canvasManager.resizeCanvas();
    }

    showNotification(message, type = 'info', duration = 3000) {
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

    // Utility methods
    getFilenameFromPath(path) {
        if (!path) return '';
        return path.replace(/\\/g, '/').split('/').pop() || '';
    }

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
}

// Global functions for HTML onclick handlers
window.showUploadModal = function(node) {
    if (window.app) {
        window.app.uiManager.showUploadModal(node);
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CopilotNodeApp();
});