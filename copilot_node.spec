block_cipher = None

a = Analysis(
    ['app.py'],
    pathex=['d:/Project/Python_Project/CopilotNode'],
    binaries=[],
    datas=[
        ('web', 'web'),                    # 包含整个web目录
        ('projects', 'projects'),          # 包含项目文件目录
        ('examples', 'examples'),          # 包含示例文件
        ('README.md', '.'),               # 包含说明文档
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'pyautogui',
        'opencv-python',
        'pynput',
        'pyscreeze',
        'numpy',
        'PIL',
        'json',
        'threading',
        'uuid',
        'datetime',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='CopilotNode',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # 设为False可隐藏控制台窗口
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='favicon.ico'  # 如果有图标文件的话
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='CopilotNode'
)