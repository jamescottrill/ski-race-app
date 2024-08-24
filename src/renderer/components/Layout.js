import React from 'react';
import Sidebar from './Sidebar';
import { Container } from '@mui/material';

export default function Layout({ children }) {
  return (
    <div className={"bg-image"} style={{ display: 'flex' }}>
      <Sidebar />
      <Container className={"w-full max-w-full"} style={{ padding: '0px' }}>
        {children}
      </Container>
    </div>
  );
}
