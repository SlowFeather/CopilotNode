// Action Nodes - 操作节点
(function(global) {
    var LiteGraph = global.LiteGraph;

    // Click Node - 点击节点
    function ClickNode() {
        this.title = "点击";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("position_mode", "absolute");
        this.addProperty("x", 0);
        this.addProperty("y", 0);
        this.addProperty("x_random", 0);
        this.addProperty("y_random", 0);
        
        // 添加标准 LiteGraph widgets
        var that = this;
        this.position_mode_widget = this.addWidget("combo", "位置模式", this.properties.position_mode, function(v){
            that.properties.position_mode = v;
            that.updateWidgets();
        }, {values: ["absolute", "current"]});
        
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
        
        // 初始化 widget 可见性
        this.updateWidgets();
        
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
        if (name === "position_mode" && this.position_mode_widget) {
            this.position_mode_widget.value = value;
            this.updateWidgets();
        } else if (name === "x" && this.x_widget) {
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
        if (this.position_mode_widget) this.position_mode_widget.value = this.properties.position_mode;
        if (this.x_widget) this.x_widget.value = this.properties.x;
        if (this.y_widget) this.y_widget.value = this.properties.y;
        if (this.x_random_widget) this.x_random_widget.value = this.properties.x_random;
        if (this.y_random_widget) this.y_random_widget.value = this.properties.y_random;
        
        // 更新 widget 可见性
        this.updateWidgets();
    };
    
    ClickNode.prototype.updateWidgets = function() {
        // 根据位置模式显示不同的 widget
        var isAbsolute = this.properties.position_mode === "absolute";
        if (this.x_widget) this.x_widget.hidden = !isAbsolute;
        if (this.y_widget) this.y_widget.hidden = !isAbsolute;
        this.size = this.computeSize();
    };

    LiteGraph.registerNodeType("autoclick/click", ClickNode);

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

    // Mouse Down Node - 鼠标按下节点
    function MouseDownNode() {
        this.title = "鼠标按下";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("position_mode", "absolute");
        this.addProperty("x", 0);
        this.addProperty("y", 0);
        this.addProperty("button", "left");
        this.addProperty("x_random", 0);
        this.addProperty("y_random", 0);
        
        // 添加标准 LiteGraph widgets
        var that = this;
        this.position_mode_widget = this.addWidget("combo", "位置模式", this.properties.position_mode, function(v){
            that.properties.position_mode = v;
            that.updateWidgets();
        }, {values: ["absolute", "current"]});
        
        this.x_widget = this.addWidget("number", "X坐标", this.properties.x, function(v){
            that.properties.x = v;
        }, {min: 0, max: 3000});
        
        this.y_widget = this.addWidget("number", "Y坐标", this.properties.y, function(v){
            that.properties.y = v;
        }, {min: 0, max: 3000});
        
        this.button_widget = this.addWidget("combo", "鼠标键", this.properties.button, function(v){
            that.properties.button = v;
        }, {values: ["left", "right", "middle"]});
        
        this.x_random_widget = this.addWidget("number", "X随机", this.properties.x_random, function(v){
            that.properties.x_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        this.y_random_widget = this.addWidget("number", "Y随机", this.properties.y_random, function(v){
            that.properties.y_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        // 初始化 widget 可见性
        this.updateWidgets();
        
        this.size = this.computeSize();
        this.resizable = true;
        
        this.color = "#e74c3c";
        this.bgcolor = "#c0392b";
        
        this.serialize_widgets = true;
    }

    MouseDownNode.title = "鼠标按下";
    MouseDownNode.desc = "按下指定鼠标键";

    MouseDownNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    MouseDownNode.prototype.onPropertyChanged = function(name, value) {
        if (name === "position_mode" && this.position_mode_widget) {
            this.position_mode_widget.value = value;
            this.updateWidgets();
        } else if (name === "x" && this.x_widget) {
            this.x_widget.value = value;
        } else if (name === "y" && this.y_widget) {
            this.y_widget.value = value;
        } else if (name === "button" && this.button_widget) {
            this.button_widget.value = value;
        } else if (name === "x_random" && this.x_random_widget) {
            this.x_random_widget.value = value;
        } else if (name === "y_random" && this.y_random_widget) {
            this.y_random_widget.value = value;
        }
    };
    
    MouseDownNode.prototype.configure = function(info) {
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
        this.syncWidgets();
    };
    
    MouseDownNode.prototype.syncWidgets = function() {
        if (this.position_mode_widget) this.position_mode_widget.value = this.properties.position_mode;
        if (this.x_widget) this.x_widget.value = this.properties.x;
        if (this.y_widget) this.y_widget.value = this.properties.y;
        if (this.button_widget) this.button_widget.value = this.properties.button;
        if (this.x_random_widget) this.x_random_widget.value = this.properties.x_random;
        if (this.y_random_widget) this.y_random_widget.value = this.properties.y_random;
        
        // 更新 widget 可见性
        this.updateWidgets();
    };
    
    MouseDownNode.prototype.updateWidgets = function() {
        // 根据位置模式显示不同的 widget
        var isAbsolute = this.properties.position_mode === "absolute";
        if (this.x_widget) this.x_widget.hidden = !isAbsolute;
        if (this.y_widget) this.y_widget.hidden = !isAbsolute;
        this.size = this.computeSize();
    };

    LiteGraph.registerNodeType("autoclick/mousedown", MouseDownNode);

    // Mouse Up Node - 鼠标松开节点
    function MouseUpNode() {
        this.title = "鼠标松开";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("position_mode", "absolute");
        this.addProperty("x", 0);
        this.addProperty("y", 0);
        this.addProperty("button", "left");
        this.addProperty("x_random", 0);
        this.addProperty("y_random", 0);
        
        // 添加标准 LiteGraph widgets
        var that = this;
        this.position_mode_widget = this.addWidget("combo", "位置模式", this.properties.position_mode, function(v){
            that.properties.position_mode = v;
            that.updateWidgets();
        }, {values: ["absolute", "current"]});
        
        this.x_widget = this.addWidget("number", "X坐标", this.properties.x, function(v){
            that.properties.x = v;
        }, {min: 0, max: 3000});
        
        this.y_widget = this.addWidget("number", "Y坐标", this.properties.y, function(v){
            that.properties.y = v;
        }, {min: 0, max: 3000});
        
        this.button_widget = this.addWidget("combo", "鼠标键", this.properties.button, function(v){
            that.properties.button = v;
        }, {values: ["left", "right", "middle"]});
        
        this.x_random_widget = this.addWidget("number", "X随机", this.properties.x_random, function(v){
            that.properties.x_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        this.y_random_widget = this.addWidget("number", "Y随机", this.properties.y_random, function(v){
            that.properties.y_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        // 初始化 widget 可见性
        this.updateWidgets();
        
        this.size = this.computeSize();
        this.resizable = true;
        
        this.color = "#27ae60";
        this.bgcolor = "#2ecc71";
        
        this.serialize_widgets = true;
    }

    MouseUpNode.title = "鼠标松开";
    MouseUpNode.desc = "松开指定鼠标键";

    MouseUpNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    MouseUpNode.prototype.onPropertyChanged = function(name, value) {
        if (name === "position_mode" && this.position_mode_widget) {
            this.position_mode_widget.value = value;
            this.updateWidgets();
        } else if (name === "x" && this.x_widget) {
            this.x_widget.value = value;
        } else if (name === "y" && this.y_widget) {
            this.y_widget.value = value;
        } else if (name === "button" && this.button_widget) {
            this.button_widget.value = value;
        } else if (name === "x_random" && this.x_random_widget) {
            this.x_random_widget.value = value;
        } else if (name === "y_random" && this.y_random_widget) {
            this.y_random_widget.value = value;
        }
    };
    
    MouseUpNode.prototype.configure = function(info) {
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
        this.syncWidgets();
    };
    
    MouseUpNode.prototype.syncWidgets = function() {
        if (this.position_mode_widget) this.position_mode_widget.value = this.properties.position_mode;
        if (this.x_widget) this.x_widget.value = this.properties.x;
        if (this.y_widget) this.y_widget.value = this.properties.y;
        if (this.button_widget) this.button_widget.value = this.properties.button;
        if (this.x_random_widget) this.x_random_widget.value = this.properties.x_random;
        if (this.y_random_widget) this.y_random_widget.value = this.properties.y_random;
        
        // 更新 widget 可见性
        this.updateWidgets();
    };
    
    MouseUpNode.prototype.updateWidgets = function() {
        // 根据位置模式显示不同的 widget
        var isAbsolute = this.properties.position_mode === "absolute";
        if (this.x_widget) this.x_widget.hidden = !isAbsolute;
        if (this.y_widget) this.y_widget.hidden = !isAbsolute;
        this.size = this.computeSize();
    };

    LiteGraph.registerNodeType("autoclick/mouseup", MouseUpNode);

    // Mouse Scroll Node - 鼠标滚轮节点
    function MouseScrollNode() {
        this.title = "鼠标滚轮";
        this.addInput("", LiteGraph.EVENT);
        this.addOutput("", LiteGraph.EVENT);
        this.addProperty("position_mode", "absolute");
        this.addProperty("x", 0);
        this.addProperty("y", 0);
        this.addProperty("direction", "up");
        this.addProperty("clicks", 3);
        this.addProperty("x_random", 0);
        this.addProperty("y_random", 0);
        
        // 添加标准 LiteGraph widgets
        var that = this;
        this.position_mode_widget = this.addWidget("combo", "位置模式", this.properties.position_mode, function(v){
            that.properties.position_mode = v;
            that.updateWidgets();
        }, {values: ["absolute", "current"]});
        
        this.x_widget = this.addWidget("number", "X坐标", this.properties.x, function(v){
            that.properties.x = v;
        }, {min: 0, max: 3000});
        
        this.y_widget = this.addWidget("number", "Y坐标", this.properties.y, function(v){
            that.properties.y = v;
        }, {min: 0, max: 3000});
        
        this.direction_widget = this.addWidget("combo", "滚动方向", this.properties.direction, function(v){
            that.properties.direction = v;
        }, {values: ["up", "down"]});
        
        this.clicks_widget = this.addWidget("number", "滚动次数", this.properties.clicks, function(v){
            that.properties.clicks = Math.max(1, Math.floor(v));
        }, {min: 1, max: 10, step: 1});
        
        this.x_random_widget = this.addWidget("number", "X随机", this.properties.x_random, function(v){
            that.properties.x_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        this.y_random_widget = this.addWidget("number", "Y随机", this.properties.y_random, function(v){
            that.properties.y_random = Math.max(0, v);
        }, {min: 0, max: 100});
        
        // 初始化 widget 可见性
        this.updateWidgets();
        
        this.size = this.computeSize();
        this.resizable = true;
        
        this.color = "#34495e";
        this.bgcolor = "#2c3e50";
        
        this.serialize_widgets = true;
    }

    MouseScrollNode.title = "鼠标滚轮";
    MouseScrollNode.desc = "滚动鼠标滚轮";

    MouseScrollNode.prototype.onExecute = function() {
        // Execution handled by backend
    };
    
    MouseScrollNode.prototype.onPropertyChanged = function(name, value) {
        if (name === "position_mode" && this.position_mode_widget) {
            this.position_mode_widget.value = value;
            this.updateWidgets();
        } else if (name === "x" && this.x_widget) {
            this.x_widget.value = value;
        } else if (name === "y" && this.y_widget) {
            this.y_widget.value = value;
        } else if (name === "direction" && this.direction_widget) {
            this.direction_widget.value = value;
        } else if (name === "clicks" && this.clicks_widget) {
            this.clicks_widget.value = value;
        } else if (name === "x_random" && this.x_random_widget) {
            this.x_random_widget.value = value;
        } else if (name === "y_random" && this.y_random_widget) {
            this.y_random_widget.value = value;
        }
    };
    
    MouseScrollNode.prototype.configure = function(info) {
        if (LiteGraph.LGraphNode.prototype.configure) {
            LiteGraph.LGraphNode.prototype.configure.call(this, info);
        }
        this.syncWidgets();
    };
    
    MouseScrollNode.prototype.syncWidgets = function() {
        if (this.position_mode_widget) this.position_mode_widget.value = this.properties.position_mode;
        if (this.x_widget) this.x_widget.value = this.properties.x;
        if (this.y_widget) this.y_widget.value = this.properties.y;
        if (this.direction_widget) this.direction_widget.value = this.properties.direction;
        if (this.clicks_widget) this.clicks_widget.value = this.properties.clicks;
        if (this.x_random_widget) this.x_random_widget.value = this.properties.x_random;
        if (this.y_random_widget) this.y_random_widget.value = this.properties.y_random;
        
        // 更新 widget 可见性
        this.updateWidgets();
    };
    
    MouseScrollNode.prototype.updateWidgets = function() {
        // 根据位置模式显示不同的 widget
        var isAbsolute = this.properties.position_mode === "absolute";
        if (this.x_widget) this.x_widget.hidden = !isAbsolute;
        if (this.y_widget) this.y_widget.hidden = !isAbsolute;
        this.size = this.computeSize();
    };

    LiteGraph.registerNodeType("autoclick/mousescroll", MouseScrollNode);

})(this);