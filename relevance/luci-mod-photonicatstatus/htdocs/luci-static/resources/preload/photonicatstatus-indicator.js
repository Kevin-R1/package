'use strict';
'require ui';
'require rpc';
'require poll';
'require baseclass';
'require dom';

// 检查全局变量，避免重复声明
if (typeof window.photonicatstatusLoaded === 'undefined') {
    window.photonicatstatusLoaded = true;

    // 添加 CSS 样式
    var style = document.createElement('style');
    style.textContent = `
    .battery-icon {
        display: inline-block;
        position: relative;
        width: 24px;
        height: 12px;
        border: 2px solid currentColor;
        border-radius: 2px;
        margin-right: 5px;
        vertical-align: middle;
    }

    .battery-icon::after {
        content: '';
        position: absolute;
        right: -4px;
        top: 50%;
        transform: translateY(-50%);
        width: 2px;
        height: 6px;
        background-color: currentColor;
        border-radius: 0 2px 2px 0;
    }

    .battery-level {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background-color: currentColor;
        transition: width 0.3s ease;
    }

    .battery-charging::before {
        content: '⚡';
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 8px;
        z-index: 1;
        color: #000;
    }`;
    document.head.appendChild(style);
}

var callBatteryStatus = rpc.declare({
    object: 'luci.photonicatstatus',
    method: 'getBatteryStatus',
    expect: { '': {} }
});

var devices = {};

function getBatteryColor(percentage) {
    if (percentage <= 20) return '#ff4444';
    if (percentage <= 30) return '#ffaa00';
    return 'currentColor';
}

function formatTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function createBatteryHTML(info) {
    var percentage = parseFloat(info.percentage);
    var color = getBatteryColor(percentage);
    var chargingClass = info.charging ? ' battery-charging' : '';
    var currentTime = formatTime(new Date());
    
    return '<div class="battery-container" style="display: inline-flex; align-items: center; gap: 5px;">' +
           '<div class="battery-icon" style="color: ' + color + '">' +
           '<div class="battery-level' + chargingClass + '" style="width: ' + percentage + '%"></div>' +
           '</div>' +
           '<span style="color: ' + color + '">' + 
           percentage + '% (' + info.voltage + _('mV') + ')</span>' +
           '<span style="margin-left: 10px;">' + currentTime + '</span>' +
           '</div>';
}

return baseclass.extend({
    __init__: function() {
        this.updateIndicator();
        poll.add(L.bind(this.updateIndicator, this), 1);
    },

    updateIndicator: function() {
        return callBatteryStatus().then(L.bind(function(devs) {
            for (var dev in devs) {
                var info = devs[dev];
                if (info.valid) {
                    info.name = "battery-" + dev.replace(/\s+/g, "-");
                    var html = createBatteryHTML(info);
                    var indicator = document.querySelector('[data-indicator="' + info.name + '"]');
                    if (indicator) {
                        indicator.innerHTML = html;
                    } else {
                        ui.showIndicator(info.name, html, null, "active");
                    }
                } else {
                    info.status = info.message;
                    ui.showIndicator(info.name, info.status, null, "inactive");
                }
                devices[dev] = info;
            }

            for (var dev in devices) {
                if (!devs.hasOwnProperty(dev)) {
                    ui.hideIndicator('battery-' + dev.replace(/\s+/g, "-"));
                    delete devices[dev];
                }
            }
        }, this));
    }
});
