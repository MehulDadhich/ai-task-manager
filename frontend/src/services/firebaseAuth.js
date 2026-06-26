import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export const registerUser = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName });
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      name: displayName,
      createdAt: new Date(),
      preferences: {
        workingHours: { start: '09:00', end: '17:00' },
        notificationLeadTime: 10,
      },
    });
    return {
      user: { uid: user.uid, email: user.email, displayName: user.displayName },
      token: await user.getIdToken(),
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    return {
      user: { uid: user.uid, email: user.email, displayName: user.displayName },
      token: await user.getIdToken(),
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      callback({
        user: { uid: user.uid, email: user.email, displayName: user.displayName },
        token,
      });
    } else {
      callback(null);
    }
  });
};
