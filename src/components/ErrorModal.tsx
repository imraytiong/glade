import React, { useState } from 'react';
import './ErrorModal.css';

export interface AppError {
  title: string;
  friendlyMessage: string;
  details?: string;
  errorCode?: string;
}

interface ErrorModalProps {
  error: AppError | null;
  onClose: () => void;
}

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
