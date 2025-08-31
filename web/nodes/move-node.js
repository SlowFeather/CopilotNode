// Move Node - 移动节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // Move Node - 移动节点
    function MoveNode() {
        this.title = "移动";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("x", 0);
        this.addProperty("y", 0);
        this.addProperty("duration", 0.2);
        this.addProperty("duration_random", 0);
        this.addProperty("speed_factor", 1.0);
        this.addProperty("speed_random", 0);
        
        // 添加标准 LiteGraph widgets
        var that = this;
        this.x_widget = this.addWidget("number", "X坐标", this.properties.x, function(v){
            that.properties.x = v;
        }, {min: 0, max: 3000});
        
        this.y_widget = this.addWidget("number", "Y坐标", this.properties.y, function(v){
            that.properties.y = v;
        }, {min: 0, max: 3000});
        
        this.duration_widget = this.addWidget("number", "时长(s)", this.properties.duration, function(v){
            that.properties.duration = Math.max(0.1, v);
        }, {min: 0.1, max: 10, step: 0.1});
        
        this.speed_widget = this.addWidget("number", "速度因子", this.properties.speed_factor, function(v){
            that.properties.speed_factor = Math.max(0.1, v);
        }, {min: 0.1, max: 5, step: 0.1});
        
        // 使用 computeSize 自动计算尺寸
        this.size = this.computeSize();
        this.resizable = true;
        
        this.color = "#50c878";
        this.bgcolor = "#2d5a3d";
        
        this.serialize_widgets = true;
    }

    MoveNode.title = "移动";
    MoveNode.desc = "移动鼠标到指定位置";

    MoveNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    MoveNode.prototype.onPropertyChanged = function(name, value) {
        // 同步 properties 和 widgets 的值
        if (name === "x" && this.x_widget) {
            this.x_widget.value = value;
        } else if (name === "y" && this.y_widget) {
            this.y_widget.value = value;
        } else if (name === "duration" && this.duration_widget) {
            this.duration_widget.value = value;
        } else if (name === "speed_factor" && this.speed_widget) {
            this.speed_widget.value = value;
        }
    };
    
    MoveNode.prototype.configure = function(info) {
        // 调用父类的 configure 方法
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
        
        // 同步所有 widget 值
        this.syncWidgets();
    };
    
    MoveNode.prototype.syncWidgets = function() {
        // 手动同步所有 widget 值
        if (this.x_widget) this.x_widget.value = this.properties.x;
        if (this.y_widget) this.y_widget.value = this.properties.y;
        if (this.duration_widget) this.duration_widget.value = this.properties.duration;
        if (this.speed_widget) this.speed_widget.value = this.properties.speed_factor;
    };

    LiteGraph.registerNodeType("autoclick/move", MoveNode);

})(this);