import React from 'react';
import Topbar from './Topbar';

/**
 * Komponen PageHeader dipertahankan sebagai alias ke Topbar untuk kompatibilitas
 */
export default function PageHeader(props) {
  return <Topbar {...props} />;
}
