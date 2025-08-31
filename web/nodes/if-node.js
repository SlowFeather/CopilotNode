// If Node - 条件节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // If Node - 条件节点
    function IfNode() {
        this.title = "IF条件";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("true", LiteGraph.EVENT);
        this.addOutput("false", LiteGraph.EVENT);
        this.addProperty("condition_type", "image_exists");
        this.addProperty("image_path", "");
        this.addProperty("target_node_id", "");
        this.addProperty("expected_result", "true");
        
        // 设置正确的尺寸属性
        this.size = [160, 140];
        this.min_size = [160, 120];
        this.max_size = [300, 200];
        this.resizable = true;
        
        this.color = "#8e44ad";
        this.bgcolor = "#5b2c6f";
    }

    IfNode.title = "IF条件";
    IfNode.desc = "根据条件执行分支逻辑";

    IfNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    IfNode.prototype.configure = function(info) {
        // 调用父类的 configure 方法
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
    };

    IfNode.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) return;
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        
        const y_offset = 45;
        
        // Display condition type
        const conditionNames = {
            'image_exists': '图像存在',
            'node_result': '节点结果'
        };
        const conditionName = conditionNames[this.properties.condition_type] || this.properties.condition_type;
        ctx.fillText(`条件: ${conditionName}`, 10, y_offset);
        
        // Display additional info based on condition type
        if (this.properties.condition_type === 'image_exists') {
            if (this.properties.image_path && this.properties.image_path.length > 0) {
                const filename = this.properties.image_path.split('/').pop();
                const displayName = filename.length > 12 
                    ? filename.substring(0, 12) + "..."
                    : filename;
                ctx.fillText(`图像: ${displayName}`, 10, y_offset + 15);
            } else {
                ctx.fillStyle = "#aaaaaa";
                ctx.fillText("未上传图像", 10, y_offset + 15);
                ctx.fillStyle = "#ffffff";
            }
        } else if (this.properties.condition_type === 'node_result') {
            ctx.fillText(`期望: ${this.properties.expected_result}`, 10, y_offset + 15);
        }
    };

    IfNode.prototype.getExtraMenuOptions = function(canvas, options) {
        var that = this;
        options.push(
            null,
            {
                content: "设置条件",
                callback: function() {
                    var conditionType = prompt("条件类型 (image_exists/node_result):", that.properties.condition_type);
                    if (conditionType) {
                        that.properties.condition_type = conditionType;
                    }
                }
            }
        );
        
        if (that.properties.condition_type === "image_exists") {
            options.push({
                content: "上传图像",
                callback: function() {
                    if (window.app) {
                        window.app.showUploadModal(that);
                    }
                }
            });
        }
    };

    // Handle size changes
    IfNode.prototype.onResize = function(size) {
        // 验证参数
        if (!size || !Array.isArray(size) || size.length < 2) {
            console.warn('Invalid size parameter in onResize:', size);
            return;
        }
        
        // 验证min_size存在
        if (!this.min_size || !Array.isArray(this.min_size) || this.min_size.length < 2) {
            console.warn('Node missing min_size property:', this.title);
            return;
        }
        
        // 确保最小内容区域
        if (size[1] < this.min_size[1]) {
            size[1] = this.min_size[1];
        }
        if (size[0] < this.min_size[0]) {
            size[0] = this.min_size[0];
        }
        
        // 检查最大尺寸限制
        if (this.max_size && Array.isArray(this.max_size) && this.max_size.length >= 2) {
            if (size[1] > this.max_size[1]) {
                size[1] = this.max_size[1];
            }
            if (size[0] > this.max_size[0]) {
                size[0] = this.max_size[0];
            }
        }
        
        this.setDirtyCanvas(true, true);
    };

    LiteGraph.registerNodeType("autoclick/if", IfNode);

})(this);