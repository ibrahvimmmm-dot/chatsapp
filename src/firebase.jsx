// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBvCO15pytLdTrvlxR9BnKCY8aVxsEYS40",
  authDomain: "chat-app-2293e.firebaseapp.com",
  projectId: "chat-app-2293e",
  storageBucket: "chat-app-2293e.firebasestorage.app",
  messagingSenderId: "795954202559",
  appId: "1:795954202559:web:3edf19426bfb69f9e7830a",
  measurementId: "G-VHBNGS8ZS8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);