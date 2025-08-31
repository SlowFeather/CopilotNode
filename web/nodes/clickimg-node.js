// ClickImg Node - 点击图像节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // ClickImg Node - 点击图像节点
    function ClickImgNode() {
        this.title = "点击图像";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("image_path", "");
        this.addProperty("confidence", 0.8);
        this.addProperty("x_random", 0);
        this.addProperty("y_random", 0);
        
        // 设置正确的尺寸属性
        this.size = [160, 140];
        this.min_size = [160, 120];
        this.max_size = [300, 200];
        this.resizable = true;
        
        this.color = "#e74c3c";
        this.bgcolor = "#a93226";
    }

    ClickImgNode.title = "点击图像";
    ClickImgNode.desc = "查找图像并点击";

    ClickImgNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    ClickImgNode.prototype.configure = function(info) {
        // 调用父类的 configure 方法
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
    };

    ClickImgNode.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) return;
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        
        const y_offset = 45;
        
        // Display image info
        let imageLabel;
        if (this.properties.image_path && this.properties.image_path.length > 0) {
            const filename = this.properties.image_path.split('/').pop();
            const displayName = filename.length > 12 
                ? filename.substring(0, 12) + "..."
                : filename;
            imageLabel = `图像: ${displayName}`;
        } else {
            ctx.fillStyle = "#aaaaaa";
            imageLabel = "未上传图像";
        }
        ctx.fillText(imageLabel, 10, y_offset);
        ctx.fillStyle = "#ffffff";
        
        // Display confidence
        const confidenceLabel = `匹配度: ${this.properties.confidence}`;
        ctx.fillText(confidenceLabel, 10, y_offset + 15);
        
        // Display random ranges if they exist
        if (this.properties.x_random > 0 || this.properties.y_random > 0) {
            const random_text = `随机: ±(${this.properties.x_random}, ${this.properties.y_random})`;
            ctx.fillText(random_text, 10, y_offset + 30);
        }
    };

    ClickImgNode.prototype.getExtraMenuOptions = function(canvas, options) {
        var that = this;
        options.push(
            null,
            {
                content: "上传图像",
                callback: function() {
                    // Trigger file upload modal
                    if (window.app) {
                        window.app.showUploadModal(that);
                    }
                }
            }
        );
    };

    // Handle size changes
    ClickImgNode.prototype.onResize = function(size) {
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

    LiteGraph.registerNodeType("autoclick/clickimg", ClickImgNode);

})(this);