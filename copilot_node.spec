import os
import sys

block_cipher = None

# 动态获取当前路径
current_path = os.path.abspath('.')

# 获取Python安装路径下的DLL文件
def get_python_dlls():
    """获取Python安装路径下的必要DLL文件"""
    import sys
    import glob

    python_dir = os.path.dirname(sys.executable)
    dlls = []

    # 查找常用的DLL文件
    dll_patterns = [
        'python*.dll',
        'vcruntime*.dll',
        'msvcp*.dll',
        'msvcr*.dll',
        'api-ms-*.dll',
        'libffi*.dll',
        'libssl*.dll',
        'libcrypto*.dll'
    ]

    for pattern in dll_patterns:
        dll_files = glob.glob(os.path.join(python_dir, pattern))
        for dll in dll_files:
            if os.path.exists(dll):
                dlls.append((dll, '.'))

    # 查找DLLs目录下的文件（Python 3.8+）
    dlls_dir = os.path.join(python_dir, 'DLLs')
    if os.path.exists(dlls_dir):
        for dll_file in glob.glob(os.path.join(dlls_dir, '*.dll')):
            dlls.append((dll_file, '.'))

    # 特别添加 _ctypes 相关的DLL
    ctypes_patterns = ['_ctypes*.pyd', 'libffi*.dll']
    libs_dir = os.path.join(python_dir, 'Lib', 'site-packages')

    for pattern in ctypes_patterns:
        for root, dirs, files in os.walk(libs_dir):
            for file in files:
                if file.lower().endswith('.pyd') or file.lower().endswith('.dll'):
                    if 'ctypes' in file.lower() or 'ffi' in file.lower():
                        dll_path = os.path.join(root, file)
                        dlls.append((dll_path, '.'))

    return dlls

a = Analysis(
    ['app.py'],
    pathex=[current_path],
    binaries=get_python_dlls(),
    datas=[
        ('web', 'web'),                    # 包含整个web目录
        ('core', 'core'),                  # 包含核心模块
        ('api', 'api'),                    # 包含API模块
        ('projects', 'projects') if os.path.exists('projects') else None,  # 项目文件目录（如果存在）
        ('examples', 'examples') if os.path.exists('examples') else None,  # 示例文件（如果存在）
        ('README.md', '.') if os.path.exists('README.md') else None,       # 说明文档（如果存在）
    ],
    hiddenimports=[
        # Flask 相关
        'flask',
        'flask_cors',
        'werkzeug',
        'werkzeug.security',
        'werkzeug.serving',
        'werkzeug.utils',
        'werkzeug.exceptions',
        'jinja2',
        'jinja2.ext',
        'markupsafe',
        'itsdangerous',
        'click',
        # 自动化相关
        'pyautogui',
        'pyscreeze',
        'pygetwindow',
        'pymsgbox',
        'pytweening',
        'pynput',
        'pynput.mouse',
        'pynput.keyboard',
        # 图像处理
        'cv2',
        'PIL',
        'PIL.Image',
        'PIL.ImageTk',
        'numpy',
        'numpy.core',
        'numpy.core._multiarray_umath',
        # 系统和网络
        'threading',
        'webbrowser',
        'json',
        'uuid',
        'datetime',
        'time',
        'os',
        'sys',
        'subprocess',
        'platform',
        'base64',
        'io',
        'tempfile',
        'shutil',
        # ctypes 相关模块
        'ctypes',
        'ctypes.util',
        'ctypes.wintypes',
        '_ctypes',
        '_ctypes_test',
        # 项目模块
        'core',
        'core.config',
        'api',
        'api.nodes',
        'api.projects',
        'api.execution',
        'api.upload',
        'api.drawings',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],  # 暂时不排除任何模块，确保兼容性
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
    optimize=0,
)

# 过滤掉 None 值的 datas
a.datas = [(dest, src, typ) for dest, src, typ in a.datas if src is not None]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='CopilotNode',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # 禁用UPX压缩，避免兼容性问题
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # 暂时启用控制台，方便调试错误
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='favicon.ico' if os.path.exists('favicon.ico') else None  # 仅在图标文件存在时使用
)