// Mock Firebase configuration
// In a real app, this would contain api keys
export const firebaseConfig = {
  apiKey: "AIzaSy...MOCK_KEY",
  authDomain: "phone-contact-app.firebaseapp.com",
  projectId: "phone-contact-app",
  storageBucket: "phone-contact-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

export const initializeApp = () => {
  console.log("Firebase App Initialized with config", firebaseConfig);
};
