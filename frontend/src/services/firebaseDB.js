import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const getTasks = async (userId) => {
  try {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const tasks = [];
    snapshot.forEach((d) => {
      const data = d.data();
      tasks.push({
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
        dueDate: data.dueDate
          ? (data.dueDate.toDate ? data.dueDate.toDate().toISOString() : data.dueDate)
          : null,
      });
    });
    return tasks;
  } catch (error) {
    console.error('Get tasks error:', error);
    throw error;
  }
};

export const createTask = async (taskData) => {
  try {
    const taskToCreate = {
      ...taskData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      dueDate: taskData.dueDate ? Timestamp.fromDate(new Date(taskData.dueDate)) : null,
    };
    const docRef = await addDoc(collection(db, 'tasks'), taskToCreate);
    return {
      id: docRef.id,
      ...taskData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('Create task error:', error);
    throw error;
  }
};

export const updateTask = async (taskId, updates) => {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    const updateData = { ...updates, updatedAt: Timestamp.now() };
    if (updates.dueDate) {
      updateData.dueDate = Timestamp.fromDate(new Date(updates.dueDate));
    }
    await updateDoc(taskRef, updateData);
  } catch (error) {
    console.error('Update task error:', error);
    throw error;
  }
};

export const deleteTask = async (taskId) => {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    console.error('Delete task error:', error);
    throw error;
  }
};
