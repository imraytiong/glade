import React, { createContext, useContext, useState } from 'react';
import ErrorModal, { AppError } from '../components/ErrorModal';

interface ErrorContextType {
  showError: (error: AppError) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState<AppError | null>(null);

  const showError = (newError: AppError) => {
    setError(newError);
  };

  const handleClose = () => {
    setError(null);
  };

  return (
    <ErrorContext.Provider value={{ showError }}>
      {children}
      <ErrorModal error={error} onClose={handleClose} />
    </ErrorContext.Provider>
  );
};
