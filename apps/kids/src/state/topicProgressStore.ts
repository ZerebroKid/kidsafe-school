import {create} from 'zustand';

interface TopicProgressState {
  /** Map of topicKey (e.g. topicId or `${chapterId}_${topicId}`) to set of completed section numbers (1..7) */
  completedSectionsByTopic: Record<string, number[]>;
  markSectionCompleted: (topicKey: string, sectionNum: number) => void;
  isSectionCompleted: (topicKey: string, sectionNum: number) => boolean;
  getCompletedCount: (topicKey: string) => number;
  getNextActiveSection: (topicKey: string) => number;
}

export const useTopicProgressStore = create<TopicProgressState>((set, get) => ({
  completedSectionsByTopic: {},

  markSectionCompleted: (topicKey: string, sectionNum: number) => {
    set(state => {
      const existing = state.completedSectionsByTopic[topicKey] || [];
      if (existing.includes(sectionNum)) {
        return state;
      }
      return {
        completedSectionsByTopic: {
          ...state.completedSectionsByTopic,
          [topicKey]: [...existing, sectionNum].sort((a, b) => a - b),
        },
      };
    });
  },

  isSectionCompleted: (topicKey: string, sectionNum: number) => {
    const list = get().completedSectionsByTopic[topicKey] || [];
    return list.includes(sectionNum);
  },

  getCompletedCount: (topicKey: string) => {
    const list = get().completedSectionsByTopic[topicKey] || [];
    return list.length;
  },

  getNextActiveSection: (topicKey: string) => {
    const list = get().completedSectionsByTopic[topicKey] || [];
    for (let i = 1; i <= 7; i++) {
      if (!list.includes(i)) {
        return i;
      }
    }
    return 7;
  },
}));
