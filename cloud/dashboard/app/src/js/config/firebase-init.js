/* ============================================
   SMART-SOJA — Firebase Configuration (SDK Modulaire)
   Approche durable : imports npm + tree-shaking Vite
   ============================================ */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, serverTimestamp, onSnapshot, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// --- Configuration ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCrMuxdiIySGATJEVc_CFyEbtJ0uaQYbgw",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-soja.firebaseapp.com",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://smart-soja-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-soja",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-soja.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "642914865423",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:642914865423:web:2ca33e2daf4f0496a2ae7a"
};

// --- Initialisation ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let rtdb = null;
try {
    rtdb = getDatabase(app);
} catch (e) {
    console.warn("Realtime Database non disponible:", e.message);
}

// --- Collections ---
export const BACKEND_URL = 'https://smartsoja-api.onrender.com';
export const COLLECTIONS = {
    USERS: 'users',
    COOPERATIVES: 'cooperatives',
    UNITS: 'units',
    PRODUCTEURS: 'producteurs',
    INDUSTRIES: 'industries',
    LOTS: 'lots',
    VALIDATIONS: 'validations',
    TELEMETRY: 'telemetry',
    DEVICES: 'devices'
};

// --- Exports ---
export { auth, db, rtdb };

// Ré-exports utilitaires Firebase (pour éviter que chaque controller importe firebase/* directement)
export {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot,
    updateDoc,
    addDoc,
    deleteDoc
};
