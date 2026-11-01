/*
 * WhatsPast — View what vanished. An open-source Electron app that locally logs 
 * and recovers deleted, edited, archived, and locked WhatsApp messages.
 * 
 * Copyright (C) 2026 Atharv Shukla <atharvotech>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://gnu.org>.
 */

package com.atharvotech.washakti;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TrackingPlugin")
public class TrackingPlugin extends Plugin {
    private static final String PREFS_NAME = "WhatsPastTrackingPrefs";
    private static final String KEY_TRACKING_MODE = "tracking_mode";

    @PluginMethod
    public void setTrackingMode(PluginCall call) {
        String mode = call.getString("mode", "passive");
        Context context = getContext();

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_TRACKING_MODE, mode).apply();

        Intent serviceIntent = new Intent(context, BackgroundTrackingService.class);

        if ("live".equals(mode)) {
            ContextCompat.startForegroundService(context, serviceIntent);
        } else {
            context.stopService(serviceIntent);
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("mode", mode);
        call.resolve(ret);
    }

    @PluginMethod
    public void getTrackingMode(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String mode = prefs.getString(KEY_TRACKING_MODE, "passive");

        JSObject ret = new JSObject();
        ret.put("mode", mode);
        call.resolve(ret);
    }

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        Context context = getContext();
        boolean ignored = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                ignored = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }
        } else {
            ignored = true;
        }

        JSObject ret = new JSObject();
        ret.put("ignored", ignored);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("requested", true);
                call.resolve(ret);
                return;
            } catch (Exception e) {
                // Fallback to general battery settings
                try {
                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception ignored) {}
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context context = getContext();
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        boolean opened = false;

        Intent[] intents = null;

        if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")) {
            intents = new Intent[] {
                new Intent().setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
                new Intent().setComponent(new ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings"))
            };
        } else if (manufacturer.contains("oppo") || manufacturer.contains("realme")) {
            intents = new Intent[] {
                new Intent().setComponent(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")),
                new Intent().setComponent(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")),
                new Intent().setComponent(new ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"))
            };
        } else if (manufacturer.contains("vivo") || manufacturer.contains("iqoo")) {
            intents = new Intent[] {
                new Intent().setComponent(new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")),
                new Intent().setComponent(new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"))
            };
        } else if (manufacturer.contains("samsung")) {
            intents = new Intent[] {
                new Intent().setComponent(new ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")),
                new Intent().setComponent(new ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity"))
            };
        } else if (manufacturer.contains("huawei") || manufacturer.contains("honor")) {
            intents = new Intent[] {
                new Intent().setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")),
                new Intent().setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"))
            };
        }

        if (intents != null) {
            for (Intent intent : intents) {
                try {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    opened = true;
                    break;
                } catch (Exception ignored) {}
            }
        }

        if (!opened) {
            // Default: open system Application Details settings
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                opened = true;
            } catch (Exception ignored) {}
        }

        JSObject ret = new JSObject();
        ret.put("opened", opened);
        ret.put("manufacturer", Build.MANUFACTURER);
        call.resolve(ret);
    }
}

