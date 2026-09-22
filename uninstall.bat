rem 修改编码 修复中文乱码
chcp 65001

@echo off

FOR /d /r . %%d IN (node_modules) DO (
  IF EXIST %%d  (
    del /f /s /q %%d
    rd /s /q %%d
  )
)

FOR /d /r . %%d IN (dist) DO (
  IF EXIST %%d  (
    del /f /s /q %%d
    rd /s /q %%d
  )
)
