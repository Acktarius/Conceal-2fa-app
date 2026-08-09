import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

describe('App integration', () => {
  it('renders the tab navigator shell', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('TabNavigator')).toBeTruthy();
    });
  });
});
