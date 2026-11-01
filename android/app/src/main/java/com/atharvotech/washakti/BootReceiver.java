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

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.content.ContextCompat;

/**
 * BootReceiver — automatically restarts Live Tracking on device reboot
 * if the user opted into 24/7 Live Tracking.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String PREFS_NAME = "WhatsPastTrackingPrefs";
    private static final String KEY_TRACKING_MODE = "tracking_mode";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String mode = prefs.getString(KEY_TRACKING_MODE, "passive");

            if ("live".equals(mode)) {
                Intent serviceIntent = new Intent(context, BackgroundTrackingService.class);
                ContextCompat.startForegroundService(context, serviceIntent);
            }
        }
    }
}

