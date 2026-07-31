import './styles/main.css';
import { Game } from './core/Game';

const container = document.getElementById('canvas-container');

if (!container) {
  throw new Error('Integrity Dash: #canvas-container element was not found in index.html.');
}

new Game(container);
