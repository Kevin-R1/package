'use strict';
'require form';
'require fs';
'require ui';
'require view';
'require poll';
'require uci';

// 定义视图，继承自 view.Map
return view.extend({
    // 加载配置和系统状态
    load: function() {
        // 返回一个Promise，用于加载USB串口设备列表
        return Promise.all([
            L.resolveDefault(fs.exec('/usr/bin/qfirehose'), {}),
            L.resolveDefault(fs.list('/dev'), []),
            L.resolveDefault(fs.list('/sys/bus/usb/devices'), []),
            uci.load('qfirehose')
        ]);
    },

    // 处理用户操作（如点击烧写按钮）
    handleAction: function(name, ev) {
        if (name != 'flash') return;
        
        // 创建一个包含倒计时的继续按钮
        var continueBtn = E('button', {
            'class': 'btn btn-primary',
            'disabled': true
        }, _('Continue') + ' (10)');
        
        // 显示警告对话框
        var modal = ui.showModal(_('Warning'), [
            E('div', { class: 'alert-message warning' }, [
                E('p', {}, _('Warning.')),
                E('ul', {}, [
                    E('li', {}, _('Please ensure before proceeding:')),
                    E('ul', {}, [
                        E('li', {}, _('The firmware you selected is from official channels and compatible with your MODEM.')),
                        E('li', {}, _('The firmware version to be flashed should be higher than the version currently in use.'))
                    ]),
                    E('li', {}, _('Use of software is completely on your own risk.')),
                    E('ul', {}, [
                        E('li', {}, _('Flashing wrong firmware or failed flash can brick your modem permanently.')),
                        E('li', {}, _('Avoid flashing, if device works without issues and updated firmware does not contain new necessary changes.')),
                        E('li', {}, _('Do not flash, if you are not willing to take this risk or do not know what you are doing.'))
                    ]),
                    E('li', {}, _('After succesful flashing, you should use terminal to issue factory reset for modem settings with AT&F command.')),
                    E('li', {}, _('mPCIe users (mostly): If modem has completely disappeared after succesful flashing, reason might be that some firmware updates set default mode to USB3 which is unsupported by some mPCIe slots, in this case, you should connect it to USB port using mPCIe -> USB adapter, even most of cheap chinese modules can reveal device. After this you should issue a command to use USB2, which may vary between models, but on most Quectel modems is: AT+QUSBCFG="SS",0'))
                ])
            ]),
            E('div', { class: 'right' }, [
                E('button', {
                    'class': 'btn',
                    'click': ui.hideModal
                }, _('Cancel')),
                ' ',
                continueBtn
            ])
        ]);

        // 开始10秒倒计时
        var countdown = 10;
        var self = this;  // 保存this引用
        var timer = setInterval(function() {
            countdown--;
            if (countdown > 0) {
                continueBtn.textContent = _('Continue') + ' (' + countdown + ')';
            } else {
                clearInterval(timer);
                continueBtn.textContent = _('Continue');
                continueBtn.disabled = false;
                continueBtn.onclick = function() {
                    ui.hideModal();
                    self.handleFlash();  // 使用保存的this引用
                };
            }
        }, 1000);

        modal;
    },

    // 烧写固件
    handleFlash: function(ev) {
        var form = this.map.lookupOption('firmware', 'config')[0].formvalue('config');
        var eraseAll = this.map.lookupOption('erase_all', 'config')[0].formvalue('config');
        var logDiv = document.getElementById('widget.cbid.qfirehose.config._log');
        
        // 清空日志显示
        if (logDiv) {
            logDiv.textContent = '';
            logDiv.textContent = '开始烧写固件...\n';
        }

        // 启动日志轮询
        this.startLogPolling();

        return fs.exec('/usr/sbin/qfirehose-start', [
            '-f', '/tmp/qfirehoseupload/' + form.split('/').pop().replace(/\.zip$/i, ''),
            eraseAll === '1' ? '-e' : ''
        ].filter(Boolean));
    },

    // 启动日志轮询
    startLogPolling: function() {
        if (!this.logPollHandle) {
            var pollFunction = L.bind(function() {
                var logDiv = document.getElementById('widget.cbid.qfirehose.config._log');
                if (!logDiv) {
                    console.log('日志框不存在');
                    return;
                }

                fs.exec('cat', ['/tmp/qfirehose_log/current.log']).then(L.bind(function(res) {
                    if (res && res.stdout) {
                        console.log('获取到日志内容，长度:', res.stdout.length);
                        logDiv.textContent = res.stdout;
                        logDiv.scrollTop = logDiv.scrollHeight;

                        // 检查是否完成烧写
                        if (res.stdout.includes('Upgrade module successfully')) {
                            console.log('烧写过程结束，停止轮询');
                            this.stopLogPolling();
                            // 停止所有轮询
                            poll.stop();
                            // 显示完成消息
                            ui.addNotification(null, E('p', _('Firmware upgrade completed successfully.')));
                        }
                    } else {
                        console.log('没有日志内容');
                    }
                }, this)).catch(function(err) {
                    console.log('读取日志出错:', err);
                });
            }, this);

            // 存储轮询函数的引用
            this.pollFunction = pollFunction;
            // 启动轮询并存储句柄
            this.logPollHandle = poll.add(pollFunction, 1);
        }
    },

    // 停止日志轮询
    stopLogPolling: function() {
        if (this.logPollHandle && this.pollFunction) {
            poll.remove(this.pollFunction);
            this.logPollHandle = null;
            this.pollFunction = null;
        }
    },

    // 渲染界面
    render: function(data) {
        // 添加自定义样式
        var styleEl = document.createElement('style');
        styleEl.textContent = `
            .cbi-value {
                display: block;
                margin-bottom: 5px;
            }
            .cbi-value-title {
                width: 200px;
            }
            .cbi-value-field {
                margin-left: 210px;
            }
            .cbi-value-field input[type="text"],
            .cbi-value-field select {
                width: 600px !important;
                max-width: 600px !important;
            }
            .cbi-value-field textarea {
                width: 800px !important;
                max-width: 800px !important;
                height: 400px !important;
                font-family: monospace;
                white-space: pre;
                overflow: auto;
            }
        `;
        document.head.appendChild(styleEl);

        // 创建表单
        var m, s, o;
        var version = '';
        
        if (data[0].stdout) {
            let match = data[0].stdout.match(/Version: ([^\n]+)/);
            if (match) version = match[1];
        }

        var ttyUSBDevices = data[1].filter(dev => dev.name.match(/^ttyUSB/)).map(dev => dev.name);
        var usbDevices = data[2].filter(dev => dev.name.match(/^./)).map(dev => dev.name);

        m = new form.Map('qfirehose');
        this.map = m;

        s = m.section(form.NamedSection, 'config', 'qfirehose', _('Qfirehose'),
            _('Qfirehose is a command-line tool for flashing Qualcomm firmware on OpenWrt.'));

        o = s.option(form.Value, 'version', _('Version'));
        o.readonly = true;
        o.default = version || '';
        o.cfgvalue = function() { return version; };
        o.write = function() {};
        o.remove = function() {};
        o.placeholder = _('Unknown');

        o = s.option(form.FileUpload, 'firmware', _('Firmware File'),
            _('Upgrade package directory path'));
        o.root_directory = '/tmp/qfirehoseupload';
        o.optional = false;

        o = s.option(form.ListValue, 'port', _('Communication Port'),
            _('Diagnose port, will auto-detect if not specified'));
        o.optional = true;
        ttyUSBDevices.forEach(dev => {
            o.value('/dev/' + dev, '/dev/' + dev);
        });

        o = s.option(form.ListValue, 'device', _('USB Device'),
            _('When multiple modules exist on the board, use -s specify which module you want to upgrade'));
        o.optional = true;
        usbDevices.forEach(dev => {
            o.value('/sys/bus/usb/devices/' + dev, '/sys/bus/usb/devices/' + dev);
        });
        o.default = '';

        // 隐藏设备类型选项
        if (false) {
            o = s.option(form.ListValue, 'device_type', _('Device Type'),
                _('Device Type, default nand, support emmc/ufs'));
            o.value('nand', 'nand');
            o.value('emmc', 'emmc');
            o.value('ufs', 'ufs');
            o.default = 'nand';
        }

        o = s.option(form.Flag, 'skip_md5', _('Skip MD5 Check'),
            _('Skip MD5 checksum verification'));
        o.default = '0';

        o = s.option(form.Flag, 'erase_all', _('Erase All Before Download'),
            _('Will erase all data including calibration data, please be careful'));
        o.default = '0';

        o = s.option(form.Button, '_flash', _('Flash Firmware'));
        o.inputstyle = 'apply';
        o.onclick = ui.createHandlerFn(this, this.handleAction, 'flash');

        o = s.option(form.TextValue, '_log', _('Log'));
        o.readonly = true;
        o.rows = 35;
        o.wrap = 'off';
        o.default = '';
        o.value = '';

        return m.render();
    }
});
