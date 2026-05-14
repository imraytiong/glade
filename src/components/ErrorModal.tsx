import React, { useState } from 'react';
import './ErrorModal.css';

export interface AppError {
  title: string;
  friendlyMessage: string;
  details?: string;
  errorCode?: string;
}

interface ErrorModalProps {
  /** The error object to display. If null, the modal will not be shown. */
  error: AppError | null;
  /** Callback function to be called when the modal is closed. */
  onClose: () => void;
}

/**
 * A modal component to display application errors.
 * It can show a friendly message, a title, and optional detailed information and an error code.
 *
 * @param {ErrorModalProps} props - The props for the ErrorModal component.
 * @returns {JSX.Element | null} The ErrorModal component, or null if no error is provided.
 */
const ErrorModal: React.FC<ErrorModalProps> = ({ error, onClose }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  return (
    <div className="error-modal-overlay">
      <div className="error-modal-content">
        <h2 className="error-modal-title">{error.title}</h2>
        <p className="error-modal-message">{error.friendlyMessage}</p>
        
        {error.details && (
          <div className="error-modal-details-container">
            <button 
              className="error-modal-details-btn" 
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            
            {showDetails && (
              <div className="error-modal-details-content">
                {error.errorCode && <div><strong>Code:</strong> {error.errorCode}</div>}
                <pre>{error.details}</pre>
              </div>
            )}
          </div>
        )}
        
        <div className="error-modal-actions">
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
