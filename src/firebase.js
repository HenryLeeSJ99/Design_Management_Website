import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace with your actual Firebase Web App config
const firebaseConfig = {
  apiKey: "AIzaSyClMBCyB9YX3GgVvElMH7RPYDAc6Hrs1U4",
  authDomain: "twdesignmanagement.firebaseapp.com",
  projectId: "twdesignmanagement",
  storageBucket: "twdesignmanagement.firebasestorage.app",
  messagingSenderId: "773764783404",
  appId: "1:773764783404:web:e309fbdcf9892555cea089",
  measurementId: "G-4H7T0DQXXM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
