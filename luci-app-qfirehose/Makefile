# Copyright (C) 2024 Zag <ntbowen2001@gmail.com>
# This is free software, licensed under the GNU General Public License v3.
# See /LICENSE for more information.

# 包含OpenWrt的构建系统规则
include $(TOPDIR)/rules.mk

# 定义包的基本信息
PKG_NAME:=luci-app-qfirehose
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_MAINTAINER:=Zag <ntbowen2001@gmail.com>
PKG_LICENSE:=GPLv3
PKG_LICENSE_FILES:=LICENSE

# 定义包的依赖关系
LUCI_TITLE:=LuCI support for QFirehose
LUCI_DESCRIPTION:=Web interface for QFirehose, a tool for flashing Qualcomm firmware on OpenWrt
LUCI_DEPENDS:=+luci-base +qfirehose +unzip +kmod-usbmon +debugfs +luci-compat
LUCI_PKGARCH:=all

# 定义安装后的操作
define Package/$(PKG_NAME)/postinst
#!/bin/sh
chmod 755 /usr/sbin/qfirehose-start
chmod 755 /usr/sbin/qfirehose-status
mkdir -p /var/log/qfirehose
chmod 755 /var/log/qfirehose
exit 0
endef

# 包含LuCI的构建模板
include $(TOPDIR)/feeds/luci/luci.mk

# 定义包的描述信息
# Submenu: 3. Applications
# 该包将出现在LuCI界面的"应用"子菜单中
# call BuildPackage - OpenWrt buildroot signature
