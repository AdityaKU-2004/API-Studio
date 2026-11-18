import React from 'react';
import { TestResult } from '../../types';
import { TestResults } from '../testing/TestResults';

interface ResponseTestsProps {
  tests: TestResult[];
}

export const ResponseTests: React.FC<ResponseTestsProps> = ({ tests }) => {
  return <TestResults tests={tests} />;
};
