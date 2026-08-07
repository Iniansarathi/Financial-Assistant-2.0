import { HashRouter } from 'react-router-dom';
import { AppProviders } from './providers';
import { AppRoutes } from './routes';

function App() {
  return (
    <HashRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </HashRouter>
  );
}

export default App;
