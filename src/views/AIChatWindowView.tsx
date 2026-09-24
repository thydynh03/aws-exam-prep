import React, { useEffect, useState } from 'react';
import { AITutorChatbox } from '../components/ai/AITutorChatbox';
import { useAuth } from '../context/useAuth';
import { questionRepository } from '../core/questionRepository';
import { storage } from '../core/storage';
import {
  POPOUT_CONTEXT_KEY,
  clearPopoutAlive,
  markPopoutAlive,
  readPopoutContext,
  type PopoutContext,
} from '../core/chatWindow';

/**
 * Trang dành riêng cho cửa sổ chat rời (/ai-chat).
 *
 * Cùng origin với cửa sổ chính nên dùng chung localStorage: lịch sử hội thoại,
 * tiến trình và cấu hình AI đều tự đồng bộ hai chiều.
 */
export const AIChatWindowView: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || 'guest_learner';

  const [context, setContext] = useState<PopoutContext>(() => readPopoutContext());

  // Báo cho cửa sổ chính biết cửa sổ này đang mở
  useEffect(() => {
    markPopoutAlive();
    const heartbeat = window.setInterval(markPopoutAlive, 2000);
    const onUnload = () => clearPopoutAlive();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('beforeunload', onUnload);
      clearPopoutAlive();
    };
  }, []);

  // Bám theo câu hỏi mà cửa sổ chính đang xem
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== POPOUT_CONTEXT_KEY) return;
      setContext(readPopoutContext());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const currentQuestion =
    context.questionId != null
      ? questionRepository.getQuestionsByIds([context.questionId])[0]
      : undefined;

  const userNotes =
    context.userNotes ??
    (context.questionId != null ? storage.getNote(context.questionId)?.noteText : undefined);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <AITutorChatbox
        popout
        userId={userId}
        currentQuestion={currentQuestion}
        selectedAnswer={context.selectedAnswer}
        isSubmitted={context.isSubmitted}
        isCorrect={context.isCorrect}
        userNotes={userNotes}
        currentMode={context.currentMode}
        isOpen
        onToggleOpen={() => window.close()}
      />
    </div>
  );
};
