import { create } from 'zustand';
import * as appService from '../services/application.service.js';

const useApplicationStore = create((set, get) => ({
  applications: [],
  pendingApprovalIds: [],
  isLoading: false,

  loadApplications: async (sessionId) => {
    set({ isLoading: true });
    try {
      const { data } = await appService.getApplications(sessionId);
      set({ applications: data.applications, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setApprovalIds: (ids) => set({ pendingApprovalIds: ids }),

  approve: async (id, edits = {}) => {
    const { data } = await appService.approveApplication(id, edits);
    set((state) => ({
      applications: state.applications.map((a) =>
        a._id === id ? { ...a, status: 'APPROVED', userEdits: edits } : a
      ),
    }));
    return data;
  },

  reject: async (id) => {
    await appService.rejectApplication(id);
    set((state) => ({
      applications: state.applications.map((a) =>
        a._id === id ? { ...a, status: 'REJECTED' } : a
      ),
    }));
  },

  clearApplications: () => set({ applications: [], pendingApprovalIds: [] }),
}));

export default useApplicationStore;
