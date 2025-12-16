import * as React from 'react';
import { cn } from '../utils/cn';

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export function AppShell({ children, sidebar, header, className }: AppShellProps) {
  return (
    <div className={cn('flex h-screen bg-background overflow-hidden', className)}>
      {/* Sidebar */}
      {sidebar && (
        <aside className="w-64 flex-shrink-0 bg-surface border-r border-border overflow-y-auto">
          {sidebar}
        </aside>
      )}
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {header && (
          <header className="h-16 flex-shrink-0 bg-surface border-b border-border flex items-center px-6">
            {header}
          </header>
        )}
        
        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function PageContainer({ 
  children, 
  className,
  maxWidth = '2xl' 
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  return (
    <div className={cn(
      'mx-auto w-full px-4 py-6 sm:px-6 lg:px-8',
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

export function PageHeader({ 
  title, 
  subtitle, 
  actions, 
  breadcrumbs,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && (
        <div className="mb-4">
          {breadcrumbs}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface ContentCardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ContentCard({ children, className, noPadding = false }: ContentCardProps) {
  return (
    <div className={cn(
      'bg-surface rounded-lg border border-border shadow-sm',
      !noPadding && 'p-6',
      className
    )}>
      {children}
    </div>
  );
}