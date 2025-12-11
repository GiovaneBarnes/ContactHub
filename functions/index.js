const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const generateMessage = require('./ai/generateMessage');
const sendSms = require('./messaging/sendSms');
const sendEmail = require('./messaging/sendEmail');
const scheduleJobs = require('./scheduling/scheduleJobs');
const writeLog = require('./logs/writeLog');

exports.generateAiMessage = generateMessage.generateMessage;
exports.sendSms = sendSms.sendSms;
exports.sendEmail = sendEmail.sendEmail;
exports.scheduleMessageDispatch = scheduleJobs.scheduleJobs;
exports.logMessageSend = writeLog.writeLog;
