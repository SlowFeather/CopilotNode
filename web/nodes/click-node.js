// Click Node - 点击节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // Click Node - 点击节点
    function ClickNode() {
        this.title = "点击";
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("x", 0);
        this.addProperty("y", 0);
        this.addProperty("x_random", 0);
        this.addProperty("y_random", 0);
        
        // 添加标准 LiteGraph widgets
        var that = this;
        this.x_widget = this.addWidget("number", "X坐标", this.properties.x, function(v){
            that.properties.x = v;
        }, {min: 0, max: 3000});
        
        this.y_widget = this.addWidget("number", "Y坐标", this.properties.y, function(v){
            that.properties.y = v;
        }, {min: 0, max: 3000});
        
        this.x_random_widget = this.addWidget("number", "X随机", this.properties.x_random, function(v){
            that.properties.x_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        this.y_random_widget = this.addWidget("number", "Y随机", this.properties.y_random, function(v){
            that.properties.y_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        // 设置正确的尺寸属性 - 使用 computeSize 自动计算
        this.size = this.computeSize();
        this.resizable = true;
        
        this.color = "#4a90e2";
        this.bgcolor = "#2d5a87";
        
        // 启用 widget 序列化
        this.serialize_widgets = true;
    }

    ClickNode.title = "点击";
    ClickNode.desc = "在指定坐标点击鼠标";

    ClickNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    ClickNode.prototype.onPropertyChanged = function(name, value) {
        // 同步 properties 和 widgets 的值
        if (name === "x" && this.x_widget) {
            this.x_widget.value = value;
        } else if (name === "y" && this.y_widget) {
            this.y_widget.value = value;
        } else if (name === "x_random" && this.x_random_widget) {
            this.x_random_widget.value = value;
        } else if (name === "y_random" && this.y_random_widget) {
            this.y_random_widget.value = value;
        }
    };
    
    ClickNode.prototype.configure = function(info) {
        // 调用父类的 configure 方法
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
        
        // 同步所有 widget 值
        this.syncWidgets();
    };
    
    ClickNode.prototype.syncWidgets = function() {
        // 手动同步所有 widget 值
        if (this.x_widget) this.x_widget.value = this.properties.x;
        if (this.y_widget) this.y_widget.value = this.properties.y;
        if (this.x_random_widget) this.x_random_widget.value = this.properties.x_random;
        if (this.y_random_widget) this.y_random_widget.value = this.properties.y_random;
    };

    LiteGraph.registerNodeType("autoclick/click", ClickNode);

})(this);