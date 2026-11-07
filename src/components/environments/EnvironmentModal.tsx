import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { Modal } from '../common/Modal';
import { EnvironmentManager } from './EnvironmentManager';

export const EnvironmentModal: React.FC = () => {
  const { isEnvironmentModalOpen, setEnvironmentModalOpen } = useAppStore();

  return (
    <Modal
      isOpen={isEnvironmentModalOpen}
      onClose={() => setEnvironmentModalOpen(false)}
      title="Manage Environments & Variables"
      description="Configure environment variables (e.g. {{base_url}}, {{api_key}}) across deployment stages"
      maxWidth="3xl"
    >
      <EnvironmentManager />
    </Modal>
  );
};
