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
        this.addProperty("key_type", "normal");
        this.addProperty("special_key", "enter");
        this.addProperty("modifier_keys", "");
        this.addProperty("hold_duration", 0.1);

        // 添加标准 LiteGraph widgets
        var that = this;
        this.type_widget = this.addWidget("combo", "输入类型", this.properties.input_type, function(v){
            that.properties.input_type = v;
            that.updateWidgets();
        }, {values: ["text", "key", "special", "combo"]});

        this.text_widget = this.addWidget("text", "文本", this.properties.text, function(v){
            that.properties.text = v;
        });

        this.key_widget = this.addWidget("text", "按键", this.properties.key, function(v){
            that.properties.key = v;
        });

        this.special_key_widget = this.addWidget("combo", "特殊按键", this.properties.special_key, function(v){
            that.properties.special_key = v;
        }, {values: [
            "enter", "space", "tab", "escape", "backspace", "delete",
            "up", "down", "left", "right", "home", "end", "page_up", "page_down",
            "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
            "insert", "print_screen", "scroll_lock", "pause",
            "caps_lock", "num_lock", "shift", "ctrl", "alt", "cmd", "win"
        ]});

        this.modifier_keys_widget = this.addWidget("text", "修饰键", this.properties.modifier_keys, function(v){
            that.properties.modifier_keys = v;
        });

        this.hold_duration_widget = this.addWidget("number", "按住时长(秒)", this.properties.hold_duration, function(v){
            that.properties.hold_duration = Math.max(0, v);
        });

        // 添加帮助信息widget (只读)
        this.help_widget = this.addWidget("text", "帮助", "", null);
        this.help_widget.disabled = true;
        this.help_widget.hidden = false;

        // 初始化 widget 可见性
        setTimeout(() => {
            this.updateWidgets();
        }, 100);

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
        } else if (name === "special_key" && this.special_key_widget) {
            this.special_key_widget.value = value;
        } else if (name === "modifier_keys" && this.modifier_keys_widget) {
            this.modifier_keys_widget.value = value;
        } else if (name === "hold_duration" && this.hold_duration_widget) {
            this.hold_duration_widget.value = value;
        }

        // 触发重绘
        if (this.graph && this.graph.canvas) {
            this.setDirtyCanvas(true, true);
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
        if (this.special_key_widget) this.special_key_widget.value = this.properties.special_key;
        if (this.modifier_keys_widget) this.modifier_keys_widget.value = this.properties.modifier_keys;
        if (this.hold_duration_widget) this.hold_duration_widget.value = this.properties.hold_duration;

        // 更新 widget 可见性
        setTimeout(() => {
            this.updateWidgets();
        }, 50);
    };
    
    KeyboardNode.prototype.updateWidgets = function() {
        // 确保所有widget都存在
        if (!this.text_widget || !this.key_widget || !this.special_key_widget ||
            !this.modifier_keys_widget || !this.hold_duration_widget) {
            return;
        }

        // 隐藏所有可选widget
        this.text_widget.hidden = true;
        this.key_widget.hidden = true;
        this.special_key_widget.hidden = true;
        this.modifier_keys_widget.hidden = true;
        this.hold_duration_widget.hidden = true;

        // 帮助widget始终显示
        if (this.help_widget) {
            this.help_widget.hidden = false;
        }

        var helpText = "";

        // 根据输入类型显示相应的widget
        switch(this.properties.input_type) {
            case "text":
                this.text_widget.hidden = false;
                helpText = "输入要发送的文本内容";
                break;
            case "key":
                this.key_widget.hidden = false;
                this.hold_duration_widget.hidden = false;
                helpText = "输入单个按键，如：a, 1, space等";
                break;
            case "special":
                this.special_key_widget.hidden = false;
                this.hold_duration_widget.hidden = false;
                helpText = "选择特殊按键（功能键、方向键等）";
                break;
            case "combo":
                this.key_widget.hidden = false;
                this.modifier_keys_widget.hidden = false;
                this.hold_duration_widget.hidden = false;
                helpText = "组合键：修饰键用+分隔，如：ctrl+alt";
                break;
            default:
                // 默认显示文本模式
                this.text_widget.hidden = false;
                helpText = "输入要发送的文本内容";
                break;
        }

        // 更新帮助信息
        if (this.help_widget) {
            this.help_widget.value = helpText;
        }

        // 重新计算节点大小
        setTimeout(() => {
            this.size = this.computeSize();
            // 强制重绘节点以更新widget显示
            if (this.graph && this.graph.canvas) {
                this.setDirtyCanvas(true, true);
            }
        }, 10);
    };

    // 节点添加到图中后的回调
    KeyboardNode.prototype.onAdded = function() {
        // 确保widget正确显示
        setTimeout(() => {
            this.updateWidgets();
        }, 200);
    };

    // 重写computeSize方法以确保正确计算大小
    KeyboardNode.prototype.computeSize = function() {
        var size = LiteGraph.LGraphNode.prototype.computeSize.call(this);
        // 确保节点有足够高度显示所有widgets
        size[1] = Math.max(size[1], 120);
        return size;
    };

    LiteGraph.registerNodeType("autoclick/keyboard", KeyboardNode);

})(this);