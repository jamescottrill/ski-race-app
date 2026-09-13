import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import App from '../renderer/App';

// danfojs drags in TensorFlow and Plotly, neither of which loads under
// jsdom; this smoke test only needs the module graph to resolve
jest.mock('danfojs', () => ({}));

describe('App', () => {
  it('should render', () => {
    expect(render(<App />)).toBeTruthy();
  });
});
