// Keyboard Node - 键盘输入节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // Keyboard Node - 键盘输入节点
    function KeyboardNode() {
        this.title = "键盘";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("text", "");
        this.addProperty("key", "");
        this.addProperty("input_type", "text");
        
        // 添加标准 LiteGraph widgets
        var that = this;
        this.type_widget = this.addWidget("combo", "输入类型", this.properties.input_type, function(v){
            that.properties.input_type = v;
            that.updateWidgets();
        }, {values: ["text", "key"]});
        
        this.text_widget = this.addWidget("text", "文本", this.properties.text, function(v){
            that.properties.text = v;
        });
        
        this.key_widget = this.addWidget("text", "按键", this.properties.key, function(v){
            that.properties.key = v;
        });
        
        // 初始化 widget 可见性
        this.updateWidgets();
        
        this.size = this.computeSize();
        this.resizable = true;
        
        this.color = "#9b59b6";
        this.bgcolor = "#663399";
        
        this.serialize_widgets = true;
    }

    KeyboardNode.title = "键盘";
    KeyboardNode.desc = "发送键盘输入";

    KeyboardNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    KeyboardNode.prototype.onPropertyChanged = function(name, value) {
        // 同步 properties 和 widgets 的值
        if (name === "input_type" && this.type_widget) {
            this.type_widget.value = value;
            this.updateWidgets();
        } else if (name === "text" && this.text_widget) {
            this.text_widget.value = value;
        } else if (name === "key" && this.key_widget) {
            this.key_widget.value = value;
        }
    };
    
    KeyboardNode.prototype.configure = function(info) {
        // 调用父类的 configure 方法
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
        
        // 同步所有 widget 值
        this.syncWidgets();
    };
    
    KeyboardNode.prototype.syncWidgets = function() {
        // 手动同步所有 widget 值
        if (this.type_widget) this.type_widget.value = this.properties.input_type;
        if (this.text_widget) this.text_widget.value = this.properties.text;
        if (this.key_widget) this.key_widget.value = this.properties.key;
        
        // 更新 widget 可见性
        this.updateWidgets();
    };
    
    KeyboardNode.prototype.updateWidgets = function() {
        // 根据输入类型显示不同的 widget
        if (this.properties.input_type === "text") {
            this.text_widget.hidden = false;
            this.key_widget.hidden = true;
        } else {
            this.text_widget.hidden = true;
            this.key_widget.hidden = false;
        }
        this.size = this.computeSize();
    };

    LiteGraph.registerNodeType("autoclick/keyboard", KeyboardNode);

})(this);