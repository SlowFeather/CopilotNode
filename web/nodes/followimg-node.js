// FollowImg Node - 跟随图像节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // FollowImg Node - 跟随图像节点
    function FollowImgNode() {
        this.title = "跟随图像";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("image_path", "");
        this.addProperty("confidence", 0.8);
        
        // 设置正确的尺寸属性
        this.size = [160, 120];
        this.min_size = [160, 100];
        this.max_size = [300, 180];
        this.resizable = true;
        
        this.color = "#34495e";
        this.bgcolor = "#2c3e50";
    }

    FollowImgNode.title = "跟随图像";
    FollowImgNode.desc = "移动鼠标到图像位置";

    FollowImgNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    FollowImgNode.prototype.configure = function(info) {
        // 调用父类的 configure 方法
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
    };

    FollowImgNode.prototype.onDrawForeground = function(ctx) {
        if (this.flags.collapsed) return;
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        
        const y_offset = 45;
        
        // Display image info with missing image indicator
        let imageLabel;
        let isImageMissing = false;
        
        if (this.properties.image_path && this.properties.image_path.length > 0) {
            const filename = this.properties.image_path.replace(/\\/g, '/').split('/').pop();
            const displayName = filename.length > 12 
                ? filename.substring(0, 12) + "..."
                : filename;
            
            // Check if this is a missing image (set by app when image is deleted)
            if (this.flags && this.flags.missingImage) {
                ctx.fillStyle = "#ff6b6b";
                imageLabel = `❌ ${displayName}`;
                isImageMissing = true;
            } else {
                imageLabel = `图像: ${displayName}`;
            }
        } else {
            ctx.fillStyle = "#aaaaaa";
            imageLabel = "未上传图像";
        }
        ctx.fillText(imageLabel, 10, y_offset);
        
        // Add warning text for missing images
        if (isImageMissing) {
            ctx.fillStyle = "#ff6b6b";
            ctx.font = "10px Arial";
            ctx.fillText("图像不存在", 10, y_offset + 12);
            ctx.font = "12px Arial";
        }
        
        ctx.fillStyle = "#ffffff";
        
        // Display confidence
        const confidenceLabel = `匹配度: ${this.properties.confidence}`;
        ctx.fillText(confidenceLabel, 10, y_offset + 15);
    };

    FollowImgNode.prototype.getExtraMenuOptions = function(canvas, options) {
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
    FollowImgNode.prototype.onResize = function(size) {
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

    LiteGraph.registerNodeType("autoclick/followimg", FollowImgNode);

})(this);