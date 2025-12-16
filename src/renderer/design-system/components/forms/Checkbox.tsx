import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || React.useId();
    
    return (
      <div className="space-y-2">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <div className="relative">
              <input
                type="checkbox"
                id={inputId}
                className="sr-only peer"
                ref={ref}
                {...props}
              />
              <label
                htmlFor={inputId}
                className={cn(
                  'w-5 h-5 rounded border-2 cursor-pointer transition-all',
                  'flex items-center justify-center',
                  'peer-checked:bg-primary-700 peer-checked:border-primary-700',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2',
                  'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                  error 
                    ? 'border-danger' 
                    : 'border-neutral-300 hover:border-neutral-400',
                  className
                )}
              >
                <Check className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" />
              </label>
            </div>
          </div>
          {label && (
            <label 
              htmlFor={inputId}
              className="ml-3 text-sm font-medium text-neutral-700 cursor-pointer select-none"
            >
              {label}
            </label>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-danger ml-8">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="text-sm text-neutral-500 ml-8">{helperText}</p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };