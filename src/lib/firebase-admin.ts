import { readFileSync, existsSync } from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const rootConfigUrl = new URL('./firebase-applet-config.json', import.meta.url);
const parentConfigUrl = new URL('../../firebase-applet-config.json', import.meta.url);
const configUrl = existsSync(rootConfigUrl) ? rootConfigUrl : parentConfigUrl;
const firebaseConfig = JSON.parse(readFileSync(configUrl, 'utf-8'));

if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();
