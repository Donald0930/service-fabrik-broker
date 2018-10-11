'use strict';

const DefaultBackupOperator = require('./backup-manager/DefaultBackupOperator');
const defaultBackupOperator = new DefaultBackupOperator();
const DefaultRestoreManager = require('./restore-manager/DefaultRestoreManager');
const RestoreStatusPoller = require('./restore-manager/RestoreStatusPoller');
const BackupStatusPoller = require('./backup-manager/BackupStatusPoller');
const defaultRestoreManager = new DefaultRestoreManager();
defaultBackupOperator.init();
defaultRestoreManager.init();
/* jshint nonew:false */
new BackupStatusPoller();
/* jshint nonew:false */
new RestoreStatusPoller();