import type { Question, OptionExplanation } from './types';
import { generateSemanticExplanation } from './semanticExplanationEngine';
import { generateAllOptionExplanations, getSelectedWrongExplanations } from './distractorExplainer';

export interface EnhancedExplanation {
  objectiveVi: string;
  solutionVi: string;
  trapWarningVi: string;
  keyTakeawayVi: string;
  ruleEn: string;
  allOptionExplanations: Record<string, OptionExplanation>;
  selectedWrongExplanations: OptionExplanation[];
}

/**
 * Generates an intelligent, question-tailored architectural explanation.
 * Prioritizes curated handcrafted breakdowns for 100% precision, and falls
 * back to semantic analysis of the actual services and dominant constraints.
 */
export function generateEnhancedExplanation(question: Question, userAnswer?: string): EnhancedExplanation {
  const semantic = generateSemanticExplanation(question);
  const allOptionExplanations = generateAllOptionExplanations(question, userAnswer);
  const selectedWrongExplanations = userAnswer ? getSelectedWrongExplanations(question, userAnswer) : [];

  return {
    objectiveVi: semantic.objectiveVi,
    solutionVi: semantic.solutionVi,
    trapWarningVi: semantic.trapWarningVi,
    keyTakeawayVi: semantic.keyTakeawayVi,
    ruleEn: semantic.ruleEn,
    allOptionExplanations,
    selectedWrongExplanations,
  };
}


