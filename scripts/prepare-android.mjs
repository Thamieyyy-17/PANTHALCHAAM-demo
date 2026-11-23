import fs from 'node:fs';
import path from 'node:path';

const androidDir = path.resolve('android');
if (!fs.existsSync(androidDir)) throw new Error('Android project was not created. Run npx cap add android first.');
const values = path.join(androidDir, 'app/src/main/res/values/strings.xml');
if (fs.existsSync(values)) {
  let xml = fs.readFileSync(values, 'utf8');
  if (xml.includes('<string name="app_name">')) xml = xml.replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">PANTHALCHAAM</string>');
  fs.writeFileSync(values, xml);
}
const rawDir = path.join(androidDir, 'app/src/main/res/raw');
fs.mkdirSync(rawDir, { recursive: true });
fs.copyFileSync(path.resolve('public/panthalchaam_notification.wav'), path.join(rawDir, 'panthalchaam_alert.wav'));
console.log('Android app label and local notification ringtone prepared.');
