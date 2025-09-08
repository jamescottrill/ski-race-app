import React from 'react';
import { cn } from '../../utils/cn';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  error?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, error, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'block text-sm font-medium mb-1',
          error ? 'text-danger' : 'text-neutral-700',
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
    );
  }
);

Label.displayName = 'Label';