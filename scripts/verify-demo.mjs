import fs from 'node:fs';
import assert from 'node:assert/strict';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const cap=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));
const app=fs.readFileSync('src/App.jsx','utf8');
const main=fs.readFileSync('src/main.jsx','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.equal(cap.appName,'PANTHALCHAAM','App name must stay PANTHALCHAAM');
assert.equal(cap.appId,'com.panthalchaam.localdemo','Keep demo app separate from live app');
assert.ok(!Object.keys(pkg.dependencies||{}).some(name=>name.includes('firebase')),'Local demo must not depend on Firebase');
assert.ok(app.includes("localStorage.getItem(STORE_KEY)"),'Local demo storage is missing');
assert.ok(app.includes("'OWNER01'") || app.includes("code:'OWNER01'"),'Sample owner account is missing');
assert.ok(app.includes('any PIN') || app.includes('demo PIN'),'Demo admin access hint is missing');
assert.ok(app.includes('noticeBoard'),'Optional notice board controls are missing');
assert.ok(main.includes("./App.jsx"),'Main entry must load src/App.jsx');
assert.ok(html.includes('/src/main.jsx'),'HTML entry must use src/main.jsx');
for (const file of ['public/icon.png','resources/icon.png','resources/splash.png','public/panthalchaam_notification.wav','scripts/prepare-android.mjs']) {
  assert.ok(fs.existsSync(file),`Missing required asset/script: ${file}`);
}
assert.ok(fs.statSync('public/panthalchaam_notification.wav').size>10000,'Notification ringtone is missing or too small');
console.log('Local demo checks passed. No Firebase dependency is included.');
