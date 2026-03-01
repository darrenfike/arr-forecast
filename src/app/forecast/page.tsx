'use client';

import { Upload, Settings, BarChart3 } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { Step1Upload } from '@/components/steps/Step1Upload';
import { Step2Configure } from '@/components/steps/Step2Configure';
import { Step3Results } from '@/components/steps/Step3Results';
import { ImportHistoryTable } from '@/components/steps/ImportHistoryTable';

const steps = [
  { id: 'upload' as const, label: 'Upload', icon: Upload },
  { id: 'configure' as const, label: 'Configure', icon: Settings },
  { id: 'results' as const, label: 'Results', icon: BarChart3 },
];

const stepOrder = ['upload', 'configure', 'results'] as const;

export default function ForecastPage() {
  const { state, dispatch } = useAppContext();
  const { currentStep } = state;

  const currentStepIndex = stepOrder.indexOf(currentStep);

  const handleStepClick = (stepId: typeof stepOrder[number]) => {
    const targetIndex = stepOrder.indexOf(stepId);
    if (targetIndex < currentStepIndex) {
      dispatch({ type: 'SET_STEP', payload: stepId });
    }
  };

  return (
    <>
      {/* Step Indicator */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-center gap-0">
            {steps.map((step, i) => {
              const stepIndex = stepOrder.indexOf(step.id);
              const isActive = step.id === currentStep;
              const isCompleted = stepIndex < currentStepIndex;
              const isClickable = isCompleted;
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex items-center">
                  {i > 0 && (
                    <div className={`w-16 h-0.5 ${
                      stepIndex <= currentStepIndex ? 'bg-blue-500' : 'bg-gray-200'
                    }`} />
                  )}
                  <button
                    onClick={() => handleStepClick(step.id)}
                    disabled={!isClickable}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : isCompleted
                          ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 cursor-default'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {step.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {currentStep === 'upload' && <Step1Upload />}
        {currentStep === 'configure' && <Step2Configure />}
        {currentStep === 'results' && <Step3Results />}

        <div className="mt-8">
          <ImportHistoryTable />
        </div>
      </main>
    </>
  );
}
