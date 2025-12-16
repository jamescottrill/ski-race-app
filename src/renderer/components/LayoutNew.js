import React from 'react';
import { AppShell } from '../design-system/layouts/AppShell';
import SidebarNew from './SidebarNew';

export default function LayoutNew({ children }) {
  return (
    <AppShell 
      sidebar={<SidebarNew />}
      className="bg-gradient-to-br from-alpine-ice to-neutral-50"
    >
      {children}
    </AppShell>
  );
}