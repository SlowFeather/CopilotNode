# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
venv\Scripts\activate


# 安装依赖
pip install -r requirements.txt
pip install pyinstaller

# 执行测试
python app.py


# 执行打包：
pyinstaller copilot_node.spec


# 退出虚拟环境
venv\Scripts\deactivate