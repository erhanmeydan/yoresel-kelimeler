import './styles/main.css';
import { renderHomePage } from './pages/HomePage';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  void renderHomePage(app);
}