// CopilotNode Node Types Registry
// This file manages all node types and their loading order

(function(global) {
    // Ensure LiteGraph is available
    if (!global.LiteGraph) {
        console.error('LiteGraph is required to load CopilotNode nodes');
        return;
    }

    // Node type categories and their descriptions
    global.CopilotNodeNodes = {
        categories: {
            'action': {
                name: '操作节点',
                description: '基本的鼠标、键盘操作节点',
                types: ['click', 'move', 'keyboard', 'wait']
            },
            'image': {
                name: '图像识别',
                description: '基于图像识别的自动化节点',
                types: ['findimg', 'clickimg', 'followimg']
            },
            'logic': {
                name: '逻辑控制',
                description: '条件判断和流程控制节点',
                types: ['if']
            }
        },

        // Get all registered node types
        getRegisteredTypes: function() {
            const types = [];
            Object.values(this.categories).forEach(category => {
                types.push(...category.types);
            });
            return types;
        },

        // Get node type by name
        getNodeInfo: function(nodeType) {
            for (const [categoryKey, category] of Object.entries(this.categories)) {
                if (category.types.includes(nodeType)) {
                    return {
                        category: categoryKey,
                        categoryName: category.name,
                        type: nodeType,
                        className: `autoclick/${nodeType}`
                    };
                }
            }
            return null;
        },

        // Check if all nodes are loaded
        validateNodeTypes: function() {
            const missing = [];
            this.getRegisteredTypes().forEach(type => {
                if (!global.LiteGraph.registered_node_types[`autoclick/${type}`]) {
                    missing.push(type);
                }
            });
            
            if (missing.length > 0) {
                console.warn('Missing node types:', missing);
                return false;
            }
            
            console.log('All CopilotNode node types loaded successfully');
            return true;
        }
    };

    // Auto-validate when all scripts are loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => global.CopilotNodeNodes.validateNodeTypes(), 100);
        });
    } else {
        setTimeout(() => global.AutoClickNodes.validateNodeTypes(), 100);
    }

})(this);