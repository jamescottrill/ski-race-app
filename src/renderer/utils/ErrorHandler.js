import toast from 'react-hot-toast';

/**
 * Centralised error handling utility for consistent error messages across the application
 */

/**
 * Handle database operation errors
 * @param {string} operation - Description of the operation (e.g., 'update competitor', 'fetch race details')
 * @param {Error} error - The error object
 * @param {boolean} showToast - Whether to show a toast notification (default: true)
 */
export const handleDatabaseError = (operation, error, showToast = true) => {
  console.error(`Database ${operation} failed:`, error);
  if (showToast) {
    toast.error(`Failed to ${operation}. Please try again.`);
  }
};

/**
 * Handle PDF generation errors
 * @param {string} pdfType - Type of PDF (e.g., 'start list', 'results')
 * @param {Error} error - The error object
 */
export const handlePdfError = (pdfType, error) => {
  console.error(`PDF generation for ${pdfType} failed:`, error);
  toast.error(`Failed to generate ${pdfType} PDF. Please try again.`);
};

/**
 * Handle file operation errors
 * @param {string} operation - Description of the operation (e.g., 'save file', 'load config')
 * @param {Error} error - The error object
 */
export const handleFileError = (operation, error) => {
  console.error(`File ${operation} failed:`, error);
  toast.error(`Failed to ${operation}. Please check file permissions.`);
};

/**
 * Show success message
 * @param {string} message - Success message to display
 */
export const showSuccess = (message) => {
  toast.success(message);
};

/**
 * Show info message
 * @param {string} message - Info message to display
 */
export const showInfo = (message) => {
  toast(message, { icon: 'ℹ️' });
};

/**
 * Show warning message
 * @param {string} message - Warning message to display
 */
export const showWarning = (message) => {
  toast(message, {
    icon: '⚠️',
    style: {
      background: '#FFA500',
      color: '#fff',
    },
  });
};

/**
 * Wrap an async operation with error handling
 * @param {Function} operation - Async function to execute
 * @param {string} operationName - Name of the operation for error messages
 * @param {Object} options - Additional options
 * @param {boolean} options.showSuccessToast - Whether to show success toast (default: false)
 * @param {string} options.successMessage - Custom success message
 * @returns {Promise<{success: boolean, data?: any, error?: Error}>}
 */
export const withErrorHandling = async (operation, operationName, options = {}) => {
  const { showSuccessToast = false, successMessage = 'Operation completed successfully' } = options;

  try {
    const result = await operation();
    if (showSuccessToast) {
      showSuccess(successMessage);
    }
    return { success: true, data: result };
  } catch (error) {
    handleDatabaseError(operationName, error);
    return { success: false, error };
  }
};