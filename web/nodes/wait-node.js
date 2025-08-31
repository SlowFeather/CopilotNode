// Wait Node - 等待节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // Wait Node - 等待节点
    function WaitNode() {
        this.title = "等待";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("duration", 1.0);
        
        // 添加标准 LiteGraph widget
        var that = this;
        this.duration_widget = this.addWidget("number", "时长(s)", this.properties.duration, function(v){
            that.properties.duration = Math.max(0.1, v);
        }, {min: 0.1, max: 60, step: 0.1});
        
        this.size = this.computeSize();
        this.resizable = true;
        
        this.color = "#f39c12";
        this.bgcolor = "#e67e22";
        
        this.serialize_widgets = true;
    }

    WaitNode.title = "等待";
    WaitNode.desc = "等待指定时间";

    WaitNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    WaitNode.prototype.onPropertyChanged = function(name, value) {
        // 同步 properties 和 widgets 的值
        if (name === "duration" && this.duration_widget) {
            this.duration_widget.value = value;
        }
    };
    
    WaitNode.prototype.configure = function(info) {
        // 调用父类的 configure 方法
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
        
        // 同步 widget 值
        this.syncWidgets();
    };
    
    WaitNode.prototype.syncWidgets = function() {
        // 手动同步 widget 值
        if (this.duration_widget) this.duration_widget.value = this.properties.duration;
    };

    LiteGraph.registerNodeType("autoclick/wait", WaitNode);

})(this);