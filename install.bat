@echo off
chcp 65001 >nul
echo ========================================
echo   z translate - Chrome 安装助手
echo ========================================
echo.
echo 正在为您打开 Chrome 扩展管理页面...
echo.
echo ⚠ 请按以下步骤操作：
echo   1. 打���右上角「开发者模式」开关
echo   2. 点击「加载已解压的扩展」
echo   3. 选择本插件的文件夹: %~dp0
echo   4. 安装完成！去任意网页选中文字按 Alt+T 试试
echo.
start chrome chrome://extensions
pause
